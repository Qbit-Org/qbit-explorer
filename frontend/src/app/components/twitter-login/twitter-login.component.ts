import { Component, EventEmitter, Input, Output } from '@angular/core';
@Component({
  selector: 'app-twitter-login',
  templateUrl: './twitter-login.component.html',
  standalone: false,
})
export class TwitterLogin {
  @Input() width: string | null = null;
  @Input() customClass: string | null = null;
  @Input() buttonString: string= 'unset';
  @Input() redirectTo: string | null = null;
  @Output() clicked = new EventEmitter<boolean>();
  @Input() disabled: boolean = false;

  constructor() {}

  twitterLogin() {
    this.clicked.emit(true);
    return false;
  }
}
