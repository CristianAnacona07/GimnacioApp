import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet} from '@angular/router';

import { Navbar } from '../../shared/navbar/navbar';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, Navbar, RouterOutlet],
  templateUrl: './dashboardSocio.html',
  styleUrl: './dashboardSocio.css',
})
export class Dashboard implements OnInit {
  username = '';
  rutina: any = null; 

  constructor(public router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.username = localStorage.getItem('nombre') || 'Socio';
  }

  }
