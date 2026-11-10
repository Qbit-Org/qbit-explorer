use crate::{
    u32_hasher_types::{u32hashset_new, U32HasherState},
    ThreadTransaction, thread_acceleration::ThreadAcceleration,
};
use std::{
    cmp::Ordering,
    collections::HashSet,
    hash::{Hash, Hasher},
};

/// Default for `-bytespersigop` (`DEFAULT_BYTES_PER_SIGOP` in policy/policy.h):
/// `GetVirtualTransactionSize` charges this many weight units per unit of sigop cost.
const BYTES_PER_SIGOP: u32 = 20;

#[allow(clippy::struct_excessive_bools)]
#[derive(Clone, Debug)]
pub struct AuditTransaction {
    pub uid: u32,
    order: u32,
    pub fee: u64,
    pub weight: u32,
    // exact sigop-adjusted weight
    pub sigop_adjusted_weight: u32,
    // sigop-adjusted vsize rounded up the the next integer
    pub sigop_adjusted_vsize: u32,
    pub sigops: u32,
    // the scale factor the vsizes above were computed with, used again for package sizes and rates
    witness_scale_factor: u32,
    adjusted_fee_per_vsize: f64,
    pub effective_fee_per_vsize: f64,
    pub dependency_rate: f64,
    pub inputs: Vec<u32>,
    pub relatives_set_flag: bool,
    pub ancestors: HashSet<u32, U32HasherState>,
    pub children: HashSet<u32, U32HasherState>,
    ancestor_fee: u64,
    ancestor_sigop_adjusted_weight: u32,
    ancestor_sigop_adjusted_vsize: u32,
    ancestor_sigops: u32,
    // Safety: Must be private to prevent NaN breaking Ord impl.
    score: f64,
    pub used: bool,
    /// whether this transaction has been moved to the "modified" priority queue
    pub modified: bool,
    pub dirty: bool,
}

impl Hash for AuditTransaction {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.uid.hash(state);
    }
}

impl PartialEq for AuditTransaction {
    fn eq(&self, other: &Self) -> bool {
        self.uid == other.uid
    }
}

impl Eq for AuditTransaction {}

#[inline]
pub fn partial_cmp_uid_score(a: (u32, u32, f64), b: (u32, u32, f64)) -> Option<Ordering> {
    // If either score is NaN, this is false,
    // and partial_cmp will return None
    if a.2 != b.2 {
        // compare by score (sorts by ascending score)
        a.2.partial_cmp(&b.2)
    } else if a.1 != b.1 {
        // tie-break by comparing partial txids (sorts by descending txid)
        Some(b.1.cmp(&a.1))
    } else {
        // tie-break partial txid collisions by comparing uids (sorts by descending uid)
        Some(b.0.cmp(&a.0))
    }
}

impl PartialOrd for AuditTransaction {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        partial_cmp_uid_score(
            (self.uid, self.order, self.score),
            (other.uid, other.order, other.score),
        )
    }
}

impl Ord for AuditTransaction {
    fn cmp(&self, other: &Self) -> Ordering {
        // Safety: The only possible values for score are f64
        // that are not NaN. This is because outside code can not
        // freely assign score. Also, calc_new_score guarantees no NaN.
        self.partial_cmp(other).expect("score will never be NaN")
    }
}

#[inline]
fn calc_fee_rate(fee: u64, vsize: f64) -> f64 {
    (fee as f64) / (if vsize == 0.0 { 1.0 } else { vsize })
}

impl AuditTransaction {
    pub fn from_thread_transaction(tx: &ThreadTransaction, maybe_acceleration: Option<Option<&ThreadAcceleration>>, witness_scale_factor: u32) -> Self {
        let fee_delta = match maybe_acceleration {
            Some(Some(acceleration)) => acceleration.delta,
            _ => 0.0
        };
        let fee = (tx.fee as u64) + (fee_delta as u64);
        // GetVirtualTransactionSize: max(weight, sigop cost * bytes per sigop) / witness scale factor,
        // rounded up to the nearest integer
        let is_adjusted = tx.weight < (tx.sigops * BYTES_PER_SIGOP);
        let sigop_adjusted_weight = tx.weight.max(tx.sigops * BYTES_PER_SIGOP);
        let sigop_adjusted_vsize = sigop_adjusted_weight.div_ceil(witness_scale_factor);
        let effective_fee_per_vsize = if is_adjusted || fee_delta > 0.0 {
            calc_fee_rate(fee, f64::from(sigop_adjusted_weight) / f64::from(witness_scale_factor))
        } else {
            tx.effective_fee_per_vsize
        };
        Self {
            uid: tx.uid,
            order: tx.order,
            fee,
            weight: tx.weight,
            sigop_adjusted_weight,
            sigop_adjusted_vsize,
            sigops: tx.sigops,
            witness_scale_factor,
            adjusted_fee_per_vsize: calc_fee_rate(fee, f64::from(sigop_adjusted_vsize)),
            effective_fee_per_vsize,
            dependency_rate: f64::INFINITY,
            inputs: tx.inputs.clone(),
            relatives_set_flag: false,
            ancestors: u32hashset_new(),
            children: u32hashset_new(),
            ancestor_fee: fee,
            ancestor_sigop_adjusted_weight: sigop_adjusted_weight,
            ancestor_sigop_adjusted_vsize: sigop_adjusted_vsize,
            ancestor_sigops: tx.sigops,
            score: 0.0,
            used: false,
            modified: false,
            dirty: effective_fee_per_vsize != tx.effective_fee_per_vsize || fee_delta > 0.0,
        }
    }

    #[inline]
    pub const fn score(&self) -> f64 {
        self.score
    }

    #[inline]
    pub const fn order(&self) -> u32 {
        self.order
    }

    /// The package's weight as `BlockAssembler::TestPackage` counts it: its vsize times the scale factor.
    #[inline]
    pub const fn ancestor_package_weight(&self) -> u32 {
        self.witness_scale_factor * self.ancestor_sigop_adjusted_vsize
    }

    #[inline]
    pub const fn ancestor_sigops(&self) -> u32 {
        self.ancestor_sigops
    }

    #[inline]
    pub fn cluster_rate(&self) -> f64 {
        // Safety: self.ancestor_weight can never be 0.
        // Even if it could, as it approaches 0, the value inside the min() call
        // grows, so if we think of 0 as "grew infinitely" then dependency_rate would be
        // the smaller of the two. If either side is NaN, the other side is returned.
        self.dependency_rate.min(calc_fee_rate(
            self.ancestor_fee,
            f64::from(self.ancestor_sigop_adjusted_weight) / f64::from(self.witness_scale_factor),
        ))
    }

    pub fn set_dirty_if_different(&mut self, cluster_rate: f64) {
        if self.effective_fee_per_vsize != cluster_rate {
            self.effective_fee_per_vsize = cluster_rate;
            self.dirty = true;
        }
    }

    /// Safety: This function must NEVER set score to NaN.
    #[inline]
    fn calc_new_score(&mut self) {
        self.score = self.adjusted_fee_per_vsize.min(calc_fee_rate(
            self.ancestor_fee,
            f64::from(self.ancestor_sigop_adjusted_vsize),
        ));
    }

    #[inline]
    pub fn set_ancestors(
        &mut self,
        ancestors: HashSet<u32, U32HasherState>,
        total_fee: u64,
        total_sigop_adjusted_weight: u32,
        total_sigop_adjusted_vsize: u32,
        total_sigops: u32,
    ) {
        self.ancestors = ancestors;
        self.ancestor_fee = self.fee + total_fee;
        self.ancestor_sigop_adjusted_weight =
            self.sigop_adjusted_weight + total_sigop_adjusted_weight;
        self.ancestor_sigop_adjusted_vsize = self.sigop_adjusted_vsize + total_sigop_adjusted_vsize;
        self.ancestor_sigops = self.sigops + total_sigops;
        self.calc_new_score();
        self.relatives_set_flag = true;
    }

    #[inline]
    pub fn remove_root(
        &mut self,
        root_txid: u32,
        root_fee: u64,
        root_sigop_adjusted_weight: u32,
        root_sigop_adjusted_vsize: u32,
        root_sigops: u32,
        cluster_rate: f64,
    ) -> f64 {
        let old_score = self.score();
        self.dependency_rate = self.dependency_rate.min(cluster_rate);
        if self.ancestors.remove(&root_txid) {
            self.ancestor_fee -= root_fee;
            self.ancestor_sigop_adjusted_weight -= root_sigop_adjusted_weight;
            self.ancestor_sigop_adjusted_vsize -= root_sigop_adjusted_vsize;
            self.ancestor_sigops -= root_sigops;
            self.calc_new_score();
        }
        old_score
    }
}

#[cfg(test)]
mod tests {
    use super::AuditTransaction;
    use crate::ThreadTransaction;

    fn tx(fee: f64, weight: u32, sigops: u32) -> ThreadTransaction {
        ThreadTransaction { uid: 1, order: 1, fee, weight, sigops, effective_fee_per_vsize: 0.0, inputs: vec![] }
    }

    #[test]
    fn qbit_vsize_equals_weight() {
        // a P2MR spend from the qbit fixtures: no sigops, 3,878 WU
        let atx = AuditTransaction::from_thread_transaction(&tx(7_758.0, 3_878, 0), None, 1);
        assert_eq!(atx.sigop_adjusted_weight, 3_878);
        assert_eq!(atx.sigop_adjusted_vsize, 3_878);
    }

    #[test]
    fn qbit_charges_20_wu_per_sigop() {
        // GetVirtualTransactionSize: max(weight, sigop cost * 20) / WITNESS_SCALE_FACTOR (1)
        let atx = AuditTransaction::from_thread_transaction(&tx(2_000.0, 1_000, 100), None, 1);
        assert_eq!(atx.sigop_adjusted_weight, 2_000);
        assert_eq!(atx.sigop_adjusted_vsize, 2_000);
        assert_eq!(atx.effective_fee_per_vsize, 1.0);
    }

    #[test]
    fn bitcoin_vsize_rounds_up() {
        // with Bitcoin's scale factor of 4 the result is upstream's ceil(weight / 4).max(sigops * 5)
        assert_eq!(AuditTransaction::from_thread_transaction(&tx(1.0, 3_878, 0), None, 4).sigop_adjusted_vsize, 970);
        assert_eq!(AuditTransaction::from_thread_transaction(&tx(1.0, 1_000, 100), None, 4).sigop_adjusted_vsize, 500);
    }
}
