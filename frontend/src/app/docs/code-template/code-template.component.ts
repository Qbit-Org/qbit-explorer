import { Component, Input, OnInit } from '@angular/core';
import { Env, StateService } from '@app/services/state.service';

@Component({
  selector: 'app-code-template',
  templateUrl: './code-template.component.html',
  styleUrls: ['./code-template.component.scss'],
  standalone: false,
})
export class CodeTemplateComponent implements OnInit {
  @Input() network: string;
  @Input() code: any;
  @Input() hostname: string;
  @Input() baseNetworkUrl: string;
  @Input() method: 'GET' | 'POST' | 'websocket' = 'GET';
  @Input() showCodeExample: any;
  env: Env;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
  }

  adjustContainerHeight( event ) {
    if( ( window.innerWidth <= 992 ) && ( this.method !== 'websocket' ) ) {
      const urlObj = new URL( window.location + '' );
      const endpointContainerEl = document.querySelector<HTMLElement>( urlObj.hash );
      const endpointContentEl = document.querySelector<HTMLElement>( urlObj.hash + ' .endpoint-content' );
      window.setTimeout( function() {
        endpointContainerEl.style.height = endpointContentEl.clientHeight + 90 + 'px';
      }, 550);
    }
  }

  sdkUnavailableMessage() {
    return 'JavaScript SDK examples are disabled until a qbit SDK is published. Use the cURL examples against this explorer API.';
  }

  normalizeHostsESModule(codeText: string) {
    codeText = codeText.replace('%{0}', 'bitcoin');
    if(['', 'main'].includes(this.network)) {
      codeText = codeText.replace('mempoolJS();', `mempoolJS({
    hostname: '${document.location.hostname}'
  });`);
    } else {
      codeText = codeText.replace('mempoolJS();', `mempoolJS({
    hostname: '${document.location.hostname}',
    network: '${this.network}'
  });`);
    }
    return codeText;
  }

  normalizeHostsCommonJS(codeText: string) {
    codeText = codeText.replace('%{0}', 'bitcoin');
    if(['', 'main'].includes(this.network)) {
      codeText = codeText.replace('mempoolJS();', `mempoolJS({
          hostname: '${document.location.hostname}'
        });`);
    } else {
      codeText = codeText.replace('mempoolJS();', `mempoolJS({
          hostname: '${document.location.hostname}',
          network: '${this.network}'
        });`);
    }
    return codeText;
  }

  wrapEsModule(_code: any) {
    return this.sdkUnavailableMessage();
  }

  wrapCommonJS(_code: any) {
    return this.sdkUnavailableMessage();
  }

  wrapImportTemplate() {
    return this.sdkUnavailableMessage();
  }

  wrapCurlTemplate(code: any) {
    if (code.codeTemplate) {
      if (this.network === 'testnet') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleTestnet);
      }
      if (this.network === 'testnet4') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleTestnet);
      }
      if (this.network === 'signet') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleSignet);
      }
      if (this.network === '' || this.network === 'main') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleMainnet);
      }
    }
  }

  wrapResponse(code: any) {
    if (this.method === 'websocket') {
      return '';
    }
    if (this.network === 'testnet') {
      return code.codeSampleTestnet.response;
    }
    if (this.network === 'testnet4') {
      return code.codeSampleTestnet.response;
    }
    if (this.network === 'signet') {
      return code.codeSampleSignet.response;
    }
    return code.codeSampleMainnet.response;
  }

  wrapPythonTemplate(code: any) {
    const websocketUrl = `${this.hostname.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}${this.baseNetworkUrl}/api/v1/ws`;
    return code.codeTemplate.python.replace(/wss:\/\/mempool\.space(?:\/(?:testnet|testnet4|signet))?\/api\/v1\/ws/g, websocketUrl);
  }

  replaceJSPlaceholder(text: string, code: any) {
    for (let index = 0; index < code.length; index++) {
      const textReplace = code[index];
      const indexNumber = index + 1;
      text = text.replace('%{' + indexNumber + '}', textReplace);
    }
    return text;
  }

  replaceCurlPlaceholder(curlText: any, code: any) {
    let text = curlText;
    text = text.replace( '[[hostname]]', this.hostname );
    text = text.replace( '[[baseNetworkUrl]]', this.baseNetworkUrl );
    for (let index = 0; index < code.curl.length; index++) {
      const textReplace = code.curl[index];
      const indexNumber = index + 1;
      text = text.replace('%{' + indexNumber + '}', textReplace);
    }

    const headersString = code.headers ? ` -H "${code.headers}"` : ``;

    if (this.network === 'main' || this.network === '' || this.network === this.env.ROOT_NETWORK) {
      if (this.method === 'POST') {
        return `curl${headersString} -X POST -sSLd "${text}"`;
      }
      return `curl${headersString} -sSL "${this.hostname}${text}"`;
    }
    if (this.method === 'POST') {
      return `curl${headersString} -X POST -sSLd "${text}"`;
    }
    return `curl${headersString} -sSL "${this.hostname}/${this.network}${text}"`;
  }

}
