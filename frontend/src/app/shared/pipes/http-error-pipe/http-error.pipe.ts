import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';
import { httpErrorStatus } from '@app/shared/http-error.utils';

@Pipe({
  name: 'httpErrorMsg',
  standalone: false,
})
export class HttpErrorPipe implements PipeTransform {
  transform(e: HttpErrorResponse | null): string {
    if (!e) {
      return '';
    }
    const errorMsg = typeof e.error === 'string' ? e.error : e.error?.error ?? '';
    return `${httpErrorStatus(e)}: ${errorMsg}`;
  }
}
