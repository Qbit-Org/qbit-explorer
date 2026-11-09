import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'httpErrorMsg',
  standalone: false,
})
export class HttpErrorPipe implements PipeTransform {
  transform(e: HttpErrorResponse | null): string {
    const errorMsg = typeof e.error === 'string' ? e.error : e.error?.error ?? '';
    // HTTP/2 has no status text, and Angular fills in 'OK' instead, so 'OK' is trusted only on a 200
    const statusText = e.statusText === 'OK' && e.status !== 200 ? '' : e.statusText;
    return e ? `${e.status}${statusText ? ` ${statusText}` : ''}: ${errorMsg}` : '';
  }
}
