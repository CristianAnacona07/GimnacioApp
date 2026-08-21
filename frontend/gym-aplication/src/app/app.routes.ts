import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth';
import { AdminDashboard } from './components/admin/dashboardAdmin/dashboardAdmin';
import { noAuthGuard } from './guards/no-auth-guard';
import { superAdminGuard } from './guards/superadmin.guard';
import { tenantGuard } from './guards/tenant.guard';
import { TenantService } from './services/tenant.service';
import { environment } from '../environments/environment';

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
  // En el subdominio de un gimnasio la raíz es su página pública; en el
  // dominio general va directo al login universal (el selector de gimnasios
  // ya no existe: cada gimnasio entra por su propio dominio).
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      // La app nativa (Capacitor) carga desde https://localhost: no hay
      // subdominio que resolver, así que un build por-gimnasio fija su
      // slug acá (ver environment.gymSlugNativo) para abrir directo su
      // página pública en vez del login universal.
      const fijo = environment.gymSlugNativo;
      if (fijo) return `/g/${fijo}`;
      const slug = inject(TenantService).slug;
      return slug ? `/g/${slug}` : '/login';
    }
  },

  // Página pública de un gimnasio (sin sesión). Si no publicó la suya, el
  // propio componente manda al login.
  {
    path: 'g/:slug',
    loadComponent: () => import('./components/landing/landing').then(m => m.Landing)
  },

  // El viejo selector de gimnasios: queda como alias por si hay enlaces
  // guardados, pero la entrada es el login universal.
  { path: 'gimnasios', redirectTo: 'login', pathMatch: 'full' },

  // Registro por invitación: el link o QR que el gimnasio le manda al socio.
  {
    path: 'invitacion/:token',
    loadComponent: () => import('./components/auth/invitacion/invitacion').then(m => m.RegistroInvitacion)
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
  {
    // Cuenta creada con contraseña temporal (ver guards/auth.ts): requiere
    // sesión iniciada, así que usa authGuard como cualquier zona de rol — el
    // guard sabe dejarla pasar aunque el flag siga activo.
    path: 'cambiar-password-inicial',
    canActivate: [authGuard],
    loadComponent: () => import('./components/auth/cambiar-password-inicial/cambiar-password-inicial').then(m => m.CambiarPasswordInicial)
  },

  // ADMIN
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [authGuard],
    children: [
      ...sharedRoutes, // Rutas compartidas
      {
        path: 'empleados',
        loadComponent: () => import('./components/admin/empleados/empleados').then(m => m.Empleados)
      },
      // La ruta vieja queda como alias por si hay enlaces guardados.
      { path: 'entrenadores', redirectTo: 'empleados', pathMatch: 'full' },
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
        path: 'configuracion',
        loadComponent: () => import('./components/admin/configuracion/configuracion').then(m => m.Configuracion)
      },
      {
        path: 'configuracion/gimnasio',
        loadComponent: () => import('./components/admin/configuracion/gimnasio/gimnasio').then(m => m.ConfiguracionGimnasio)
      },
      {
        path: 'configuracion/agenda',
        loadComponent: () => import('./components/admin/configuracion/agenda/agenda').then(m => m.ConfiguracionAgenda)
      },
      {
        path: 'configuracion/pagina',
        loadComponent: () => import('./components/admin/configuracion/pagina/pagina').then(m => m.ConfiguracionPagina)
      },
      {
        path: 'configuracion/acceso',
        loadComponent: () => import('./components/admin/configuracion/acceso/acceso').then(m => m.ConfiguracionAcceso)
      },
      {
        path: 'configuracion/datos',
        loadComponent: () => import('./components/admin/configuracion/datos/datos').then(m => m.ConfiguracionDatos)
      },
      {
        path: 'configuracion/auditoria',
        loadComponent: () => import('./components/admin/configuracion/auditoria/auditoria').then(m => m.ConfiguracionAuditoria)
      },
      {
        path: 'configuracion/cuenta',
        loadComponent: () => import('./components/admin/configuracion/cuenta/cuenta').then(m => m.ConfiguracionCuenta)
      },
      // La antigua pantalla "Mi Cuenta" queda como alias: hay enlaces guardados
      // y accesos directos que siguen apuntando aquí.
      { path: 'settings', redirectTo: 'configuracion', pathMatch: 'full' },
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
        path: 'agendar',
        loadComponent: () => import('./components/socio/agendar/agendar').then(m => m.Agendar)
      },
      {
        path: 'feedback',
        loadComponent: () => import('./components/socio/feedback/feedback').then(m => m.FeedbackComponent)
      },
      { path: '', redirectTo: 'noticias', pathMatch: 'full' }
    ]
  },

  // EMPLEADO (recepcionista, limpieza, nutricionista)
  {
    path: 'empleado',
    canActivate: [authGuard],
    loadComponent: () => import('./components/empleado/dashboard/dashboard').then(m => m.EmpleadoDashboard),
    children: [
      {
        path: 'recepcion',
        // Reusa la pantalla de Recepción del admin: el backend ya permite
        // sus endpoints al empleado con cargo de recepcionista.
        loadComponent: () => import('./components/admin/recepcion/recepcion').then(m => m.Recepcion)
      },
      {
        path: 'inicio',
        loadComponent: () => import('./components/empleado/inicio/inicio').then(m => m.EmpleadoInicio)
      },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' }
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
        loadComponent: () => import('./components/admin/socios/socios').then(m => m.Socios)
      },
      // Los suyos, con la agenda y el seguimiento propios del entrenador.
      {
        path: 'mis-socios',
        loadComponent: () => import('./components/entrenador/mis-socios/mis-socios').then(m => m.MisSocios)
      },
      {
        path: 'socio/:id',
        loadComponent: () => import('./components/entrenador/socio-detalle/socio-detalle').then(m => m.SocioDetalle)
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
        path: 'empleados',
        loadComponent: () => import('./components/admin/empleados/empleados').then(m => m.Empleados)
      },
      {
        path: 'recepcion',
        loadComponent: () => import('./components/admin/recepcion/recepcion').then(m => m.Recepcion)
      },
      {
        path: 'agenda',
        loadComponent: () => import('./components/entrenador/agenda/agenda').then(m => m.AgendaProfesional)
      },
      ...sharedRoutes,
      { path: '', redirectTo: 'mis-socios', pathMatch: 'full' }
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