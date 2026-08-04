import { Routes } from '@angular/router';
import { authGuard } from './guards/auth';
import { AdminDashboard } from './components/admin/dashboardAdmin/dashboardAdmin';
import { noAuthGuard } from './guards/no-auth-guard';
import { superAdminGuard } from './guards/superadmin.guard';
import { tenantGuard } from './guards/tenant.guard';

// Rutas compartidas entre admin y socio
const sharedRoutes: Routes = [
  { 
    path: 'noticias', 
    loadComponent: () => import('./components/noticias/noticias').then(m => m.Noticias) 
  },
  { 
    path: 'planes', 
    loadComponent: () => import('./components/planes/planes').then(m => m.Planes) 
  },
  { 
    path: 'pagos', 
    loadComponent: () => import('./components/pagos/pagos').then(m => m.Pagos) 
  }
];

export const routes: Routes = [
  { path: '', redirectTo: '/gimnasios', pathMatch: 'full' },

  {
    path: 'gimnasios',
    canActivate: [tenantGuard], // en subdominio de gym el selector se salta → /login
    loadComponent: () => import('./components/gym-selector/gym-selector').then(m => m.GymSelector)
  },
  {
    path: 'gym/nuevo',
    loadComponent: () => import('./components/gym-registro/gym-registro').then(m => m.GymRegistro)
  },

  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./components/auth/login/login').then(m => m.Login)
  },
  
  {
    path: 'register',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./components/auth/register/register').then(m => m.Register)
  },
  {
    path: 'forgot-password',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./components/auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/auth/reset-password/reset-password').then(m => m.ResetPassword)
  },

  // ADMIN
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [authGuard],
    children: [
      ...sharedRoutes, // Rutas compartidas
      { 
        path: 'entrenadores',
        loadComponent: () => import('./components/admin/entrenadores/entrenadores').then(m => m.Entrenadores) 
      },
      {
        path: 'socios',
        loadComponent: () => import('./components/admin/socios/socios').then(m => m.Socios)
      },
      {
        path: 'recepcion',
        loadComponent: () => import('./components/admin/recepcion/recepcion').then(m => m.Recepcion)
      },
      {
        path: 'matricula',
        loadComponent: () => import('./components/admin/matricula/matricula').then(m => m.Matricula)
      },
      { 
        path: 'rutinas', 
        loadComponent: () => import('./components/admin/rutinas/rutinas').then(m => m.Rutinas) 
      },
      { 
        path: 'rutinas/:id', 
        loadComponent: () => import('./components/admin/rutinas/rutinas').then(m => m.Rutinas) 
      },
      { 
        path: 'detalle-rutina/:id', 
        loadComponent: () => import('./components/admin/detalle-rutina/detalle-rutina').then(m => m.DetalleRutina) 
      },
      {
        path: 'settings',
        loadComponent: () => import('./components/admin/settings/settings').then(m => m.Settings)
      },
      { path: '', redirectTo: 'noticias', pathMatch: 'full' }
    ]
  },

  // SOCIO
  {
    path: 'socio',
    canActivate: [authGuard],
    loadComponent: () => import('./components/socio/dashboardSocio/dashboardSocio').then(m => m.Dashboard),
    children: [
      ...sharedRoutes, // Rutas compartidas
      { 
        path: 'perfil', 
        loadComponent: () => import('./components/socio/perfil/perfil')
        .then(m => m.Perfil) 
      },
      { 
        path: 'datos-personales', 
        loadComponent: () => import('./components/socio/datos-personales/datos-personales')
        .then(m => m.DatosPersonales) 
      },
      {
        path: 'mi-rutina',
        loadComponent: () => import('./components/socio/mi-rutina/mi-rutina').then(m => m.MiRutina)
      },
      {
        path: 'progreso',
        loadComponent: () => import('./components/socio/progreso/progreso').then(m => m.Progreso)
      },
      {
        path: 'medidas',
        loadComponent: () => import('./components/socio/medidas/medidas').then(m => m.Medidas)
      },
      {
        path: 'feedback',
        loadComponent: () => import('./components/socio/feedback/feedback').then(m => m.FeedbackComponent)
      },
      { path: '', redirectTo: 'noticias', pathMatch: 'full' }
    ]
  },

  // ENTRENADOR
  {
    path: 'entrenador',
    canActivate: [authGuard],
    loadComponent: () => import('./components/entrenador/dashboard/dashboard').then(m => m.EntrenadorDashboard),
    children: [
      {
        path: 'socios',
        loadComponent: () => import('./components/entrenador/mis-socios/mis-socios').then(m => m.MisSocios)
      },
      {
        path: 'socio/:id',
        loadComponent: () => import('./components/entrenador/socio-detalle/socio-detalle').then(m => m.SocioDetalle)
      },
      { path: '', redirectTo: 'socios', pathMatch: 'full' }
    ]
  },

  // SUPERADMIN
  {
    path: 'sa',
    loadComponent: () => import('./components/superadmin/sa-login/sa-login').then(m => m.SaLogin)
  },
  {
    path: 'plataforma',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./components/superadmin/superadmin').then(m => m.SuperAdmin)
  },

  // OTRAS RUTAS
  { 
    path: 'ejercicio/:nombre', 
    loadComponent: () => import('./components/ejercicio-detalle/ejercicio-detalle').then(m => m.EjercicioDetalle) 
  },

  { path: '**', redirectTo: '/login' }
];