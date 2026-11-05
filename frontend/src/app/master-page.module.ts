import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { MasterPageComponent } from '@components/master-page/master-page.component';
import { SharedModule } from '@app/shared/shared.module';

import { StartComponent } from '@components/start/start.component';
import { PushTransactionComponent } from '@components/push-transaction/push-transaction.component';
import { TestTransactionsComponent } from '@components/test-transactions/test-transactions.component';
import { CalculatorComponent } from '@components/calculator/calculator.component';
import { BlocksList } from '@components/blocks-list/blocks-list.component';
import { RbfList } from '@components/rbf-list/rbf-list.component';
import { StaleList } from '@components/stale-list/stale-list.component';
import { StratumList } from '@components/stratum/stratum-list/stratum-list.component';

const browserWindow = window || {};
// @ts-ignore
const browserWindowEnv = browserWindow.__env || {};

const routes: Routes = [
  {
    path: '',
    component: MasterPageComponent,
    children: [
      {
        path: 'mining/blocks',
        redirectTo: 'blocks',
        pathMatch: 'full'
      },
      {
        path: 'tx/push',
        component: PushTransactionComponent,
      },
      {
        path: 'pushtx',
        component: PushTransactionComponent,
      },
      {
        path: 'tx/test',
        component: TestTransactionsComponent,
      },
      {
        path: 'about',
        loadChildren: () => import('@components/about/about.module').then(m => m.AboutModule),
      },
      {
        path: 'blocks/stale',
        component: StaleList,
      },
      {
        path: 'blocks/:page',
        component: BlocksList,
      },
      {
        path: 'blocks',
        redirectTo: 'blocks/1',
      },
      {
        path: 'rbf',
        component: RbfList,
      },
      ...(browserWindowEnv.STRATUM_ENABLED ? [{
        path: 'stratum',
        component: StartComponent,
        children: [
          {
            path: '',
            component: StratumList,
          }
        ]
      }] : []),
      {
        path: 'terms-of-service',
        loadChildren: () => import('@components/terms-of-service/terms-of-service.module').then(m => m.TermsOfServiceModule),
      },
      {
        path: 'privacy-policy',
        loadChildren: () => import('@components/privacy-policy/privacy-policy.module').then(m => m.PrivacyPolicyModule),
      },
      {
        path: 'trademark-policy',
        loadChildren: () => import('@components/trademark-policy/trademark-policy.module').then(m => m.TrademarkModule),
      },
      {
        path: 'tx',
        component: StartComponent,
        data: { preload: true, networkSpecific: true },
        loadChildren: () => import('@components/transaction/transaction.module').then(m => m.TransactionModule),
      },
      {
        path: 'block',
        component: StartComponent,
        data: { preload: true, networkSpecific: true },
        loadChildren: () => import('@components/block/block.module').then(m => m.BlockModule),
      },
      {
        path: 'docs',
        loadChildren: () => import('@app/docs/docs.module').then(m => m.DocsModule),
        data: { preload: true },
      },
      {
        path: 'api',
        loadChildren: () => import('@app/docs/docs.module').then(m => m.DocsModule)
      },
      {
        path: 'tools/calculator',
        component: CalculatorComponent
      }
    ],
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class MasterPageRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    MasterPageRoutingModule,
    SharedModule,
  ],
  declarations: [
    MasterPageComponent,
  ],
  exports: [
    MasterPageComponent,
  ]
})
export class MasterPageModule { }
