import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { GymService } from '../../services/gym.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin.html',
  styleUrl: './superadmin.css'
})
export class SuperAdmin implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  gyms: any[] = [];
  cargando = false;
  // Dashboard es la puerta de entrada del panel; Gimnasios queda como
  // pestaña de siempre para administrar cada gym individualmente.
  tabActiva: 'dashboard' | 'gyms' | 'planes' | 'superadmins' | 'facturacion' = 'dashboard';
  mostrarForm = false;
  guardando = false;
  editando: any = null; // gym que se está editando

  // --- Superadmins: cuentas globales (gymId null), solo gestionables por
  // otro superadmin — ver feedback_superadmin_privilegios_exclusivos ---
  superadmins: any[] = [];
  cargandoSuperadmins = false;
  mostrarFormSuperadmin = false;
  guardandoSuperadmin = false;
  nuevoSuperadmin = { nombre: '', email: '' };
  passwordTemporalSuperadmin: { email: string; password: string | null; invitacionEnviada?: boolean } | null = null;
  editandoSuperadmin: any = null; // superadmin que se está editando (nombre/email)

  // --- Dashboard: métricas globales de la plataforma ---
  // Ingresos separados en dos series — "por socio" y "mensual" son dos
  // negocios distintos (uno escala con la cantidad de socios, el otro es un
  // monto fijo) — sumarlos en un solo número los confundía.
  dashboard: {
    sociosActivos: number;
    adminTotal: number;
    gimnasiosActivos: number;
    ingresosPorSuscriptor: { ultimoMes: { mes: string; total: number }; porMes: { mes: string; total: number }[] };
    ingresosMensual: { ultimoMes: { mes: string; total: number }; porMes: { mes: string; total: number }[] };
    nuevosSociosPorMes: { mes: string; cantidad: number }[];
  } | null = null;

  // --- Planes de plataforma (lo que le cobramos a cada gimnasio; no
  // confundir con los planes de membresía que cada gimnasio le vende a sus
  // propios socios, esos viven en otra pantalla) ---
  planesPlataforma: any[] = [];
  cargandoPlanes = false;
  mostrarFormPlan = false;
  guardandoPlan = false;
  editandoPlan: any = null;
  // Qué recuadro (mensual / por suscriptor) se tocó: decide qué campo edita
  // el único input "Valor" del formulario inline, ver abrirEditarPlan().
  editandoPlanCampo: 'mensual' | 'porSuscriptor' | null = null;
  editandoValor: number | null = null;
  // Un plan siempre guarda los dos precios de una — el gimnasio elige cuál
  // de los dos le aplica al asignarlo — así que al crearlo se piden juntos,
  // sin dejar ninguno en $0 por defecto.
  nuevoPlan = { nombre: '', precioMensual: null as number | null, precioPorSuscriptor: null as number | null };

  /** true cuando el superadmin eligió "Otro" en el selector de Plan, para escribir un nombre nuevo. */
  nuevoPlanNombrePersonalizado = false;

  /** Nombres de plan ya creados (Pro, Super, …), para ofrecerlos en el selector
   *  del formulario de "Nuevo plan" — sin nombres repetidos aunque haya varias
   *  filas con el mismo nombre. */
  get nombresPlanesExistentes(): string[] {
    return [...new Set(this.planesPlataforma.map(p => p.nombre))];
  }

  onCambiaPlanSeleccionado(valor: string) {
    this.nuevoPlanNombrePersonalizado = valor === '__otro__';
    this.nuevoPlan.nombre = this.nuevoPlanNombrePersonalizado ? '' : valor;
  }

  // --- Facturación de la plataforma: lo que cada gimnasio le paga a la
  // plataforma, registrado a mano. No confundir con /admin/pagos, que son
  // los pagos de los socios a su gimnasio — esto es un nivel arriba. ---
  pagosPlataforma: any[] = [];
  cargandoPagos = false;
  mostrarFormPago = false;
  guardandoPago = false;
  filtroEstadoPago: '' | 'pagada' | 'vencida' | 'pendiente' | 'anulada' = '';
  filtroDesdePago = '';
  filtroHastaPago = '';
  // Se elige el MES directamente (no un día): como el período que cubre un
  // pago es siempre el mes calendario completo, pedir una fecha puntual con
  // <input type="date"> era engañoso — parecía que el día importaba, y no.
  // "fecha" se arma recién al enviar (ver crearPagoPlataforma).
  nuevoPago = {
    gymId: '', monto: null as number | null,
    mes: new Date().getMonth() + 1, // 1-12
    anio: new Date().getFullYear(),
    metodo: ''
  };

  readonly MESES = [
    { valor: 1, nombre: 'Enero' }, { valor: 2, nombre: 'Febrero' }, { valor: 3, nombre: 'Marzo' },
    { valor: 4, nombre: 'Abril' }, { valor: 5, nombre: 'Mayo' }, { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' }, { valor: 8, nombre: 'Agosto' }, { valor: 9, nombre: 'Septiembre' },
    { valor: 10, nombre: 'Octubre' }, { valor: 11, nombre: 'Noviembre' }, { valor: 12, nombre: 'Diciembre' },
  ];

  /** Año pasado, actual y el que viene — alcanza para poner al día un pago
   *  atrasado o cargar uno adelantado, sin una lista larga sin sentido acá. */
  get aniosDisponibles(): number[] {
    const actual = new Date().getFullYear();
    return [actual - 1, actual, actual + 1];
  }
  // Mismas opciones que ya usa matrícula para el pago de un socio — la
  // plataforma no le abre a cada gym su propia lista de métodos, es un solo
  // desplegable genérico.
  readonly metodosPagoPlataforma = ['Nequi', 'Efectivo', 'Tarjeta', 'Transferencia'];

  // Geometría del gráfico de barras "socios nuevos por mes" — mismo espíritu
  // que los getters de xPos/yPos/yLabels en components/socio/progreso/progreso.ts,
  // simplificado porque acá son barras de altura fija, no una polilínea.
  readonly DASH_BARRA_ANCHO = 52;
  readonly DASH_H = 160;
  // top: 20, no 12 — la barra más alta llega al techo del gráfico y el
  // número se dibuja 6px arriba de la barra; con solo 12px de margen ese
  // texto quedaba recortado contra el borde superior del SVG.
  readonly DASH_PAD = { top: 20, right: 16, bottom: 28, left: 36 };

  get dashInnerH(): number {
    return this.DASH_H - this.DASH_PAD.top - this.DASH_PAD.bottom;
  }

  get dashMaxCantidad(): number {
    const valores = this.dashboard?.nuevosSociosPorMes.map(m => m.cantidad) || [];
    return Math.max(1, ...valores); // mínimo 1 para no dividir por cero con todo en 0
  }

  get dashDataW(): number {
    const n = this.dashboard?.nuevosSociosPorMes.length || 0;
    return this.DASH_PAD.right + Math.max(1, n) * this.DASH_BARRA_ANCHO;
  }

  dashXBarra(i: number): number {
    return i * this.DASH_BARRA_ANCHO + this.DASH_BARRA_ANCHO / 2;
  }

  dashAlturaBarra(cantidad: number): number {
    return (cantidad / this.dashMaxCantidad) * this.dashInnerH;
  }

  dashYBarra(cantidad: number): number {
    return this.DASH_PAD.top + this.dashInnerH - this.dashAlturaBarra(cantidad);
  }

  dashYLabels(): { val: string; y: number }[] {
    return [0, 0.5, 1].map(f => ({
      val: (this.dashMaxCantidad * f).toFixed(0),
      y: this.DASH_PAD.top + this.dashInnerH - f * this.dashInnerH
    }));
  }

  // Enero → "ene", igual que formatFecha en progreso.ts pero con mes solo.
  dashMesCorto(mes: string): string {
    const [y, m] = mes.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'short' });
  }

  // '2026-08' → "Agosto", para el nombre completo en la tarjeta de ingresos
  // ("Ingresos estimados de Agosto") — dashMesCorto ya existe pero abreviado,
  // sirve para el eje del gráfico, no para el título de la tarjeta.
  nombreMes(mes: string): string {
    const [y, m] = mes.split('-').map(Number);
    const nombre = new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long' });
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  // Mismo gráfico de barras que "Socios nuevos por mes" (DASH_H/DASH_PAD/
  // dashXBarra/dashMesCorto son genéricos, no dependen del dataset), pero
  // para los totales en pesos — recibe el arreglo en vez de leerlo de un
  // único `dashboard.ingresosPorMes` porque ahora hay dos series (por
  // socio y mensual), cada una con su propio gráfico.
  dashMaxIngreso(porMes: { total: number }[] | undefined): number {
    const valores = (porMes || []).map(m => m.total);
    return Math.max(1, ...valores);
  }

  dashAlturaBarraIngreso(total: number, max: number): number {
    return (total / max) * this.dashInnerH;
  }

  dashYBarraIngreso(total: number, max: number): number {
    return this.DASH_PAD.top + this.dashInnerH - this.dashAlturaBarraIngreso(total, max);
  }

  dashYLabelsIngreso(max: number): { val: string; y: number }[] {
    return [0, 0.5, 1].map(f => ({
      val: this.formatMoneda(max * f),
      y: this.DASH_PAD.top + this.dashInnerH - f * this.dashInnerH
    }));
  }

  // Los totales del dashboard ya llegan como number (el backend suma con
  // Number()); `precioMensual`/`precioPorSuscriptor` de un plan llegan como
  // string (Prisma serializa Decimal así) — acepta las dos formas.
  formatMoneda(n: number | string): string {
    return '$' + Math.round(Number(n)).toLocaleString('es');
  }

  /**
   * ¿El "Total hoy" (socios × valor, en vivo) difiere de lo que esa fila
   * realmente cobró? No es un error en sí — un pago viejo es normal que no
   * coincida con los socios de hoy — pero conviene resaltarlo. `totalActual`
   * y `monto` llegan como Decimal serializado (string) o number según el
   * campo, por eso se comparan con Number() acá y no con !== directo en el
   * template (Angular no puede llamar un global como Number() en el HTML).
   */
  hayDiscrepancia(p: { totalActual: number | string | null; monto: number | string }): boolean {
    return p.totalActual != null && Math.round(Number(p.totalActual)) !== Math.round(Number(p.monto));
  }

  esVencido(fecha: string | Date): boolean {
    return new Date(fecha).getTime() < Date.now();
  }

  // Debe coincidir con DIAS_GRACIA del backend (planPlataformaVigencia.js) —
  // los días entre que vence la suscripción y se desactiva el gimnasio de
  // verdad. Duplicado acá porque es solo para pintar la tarjeta a tiempo; la
  // desactivación real la decide siempre el backend.
  readonly DIAS_GRACIA = 5;

  /** true mientras el gym venció pero todavía está dentro de los días de gracia. */
  enGracia(fecha: string | Date): boolean {
    if (!this.esVencido(fecha)) return false;
    const finGracia = new Date(fecha);
    finGracia.setDate(finGracia.getDate() + this.DIAS_GRACIA);
    return Date.now() < finGracia.getTime();
  }

  // Contraseña temporal del admin recién creado: se muestra una sola vez,
  // en una tarjeta persistente (un toast se autodesaparece antes de poder
  // copiarla o dictarla).
  adminCreado: { email: string; passwordTemporal: string | null; invitacionEnviada?: boolean } | null = null;

  cerrarAdminCreado(): void {
    this.adminCreado = null;
  }

  // --- Administrador(es) del gym que se está editando ---
  editandoAdmins: any[] | null = null;
  nuevoAdminGym = { email: '', nombre: '', identificacion: '', telefono: '' };
  guardandoAdminGym = false;
  /** _id del admin al que se le está reenviando la invitación (null = ninguno). */
  reinvitandoAdminId: string | null = null;

  // Dominio raíz de la plataforma para los subdominios por gimnasio.
  // Ej: slug "sogafit" → sogafit.snakegym.cloud.
  //
  // Sale de environment, NO escrito a mano: estuvo fijo en el dominio de
  // ejemplo 'micro-gimnacios.com' y siguió mostrando esa dirección al crear y
  // editar gimnasios mucho después de que el dominio real existiera — el
  // superadmin veía (y le pasaba al cliente) una URL que no lleva a ningún
  // lado. El Dockerfile del frontend reescribe tenantRootDomain al construir
  // la imagen, así que este valor acompaña al dominio que tenga el servidor.
  readonly dominioBase = environment.tenantRootDomain;

  // Simplificación de colores: el color PRINCIPAL (navbar) se aplica también a
  // botones (primario), menú lateral y días de rutina — así solo hay que elegir
  // 3 colores (Principal, Fondo, Secundario) en vez de 6.
  aplicarPrincipal(obj: any, valor: string) {
    obj.colores.navbar = valor;
    obj.colores.primario = valor;
    obj.colores.menu = valor;
    obj.colores.dias = valor;
  }

  // Extrae el ID de una playlist de Spotify desde su enlace, URI o el ID pelado.
  // Ej: https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=... → 37i9dQZF1DX76Wlfdnj7AP
  extraerPlaylistId(valor: string): string {
    if (!valor) return '';
    const s = valor.trim();
    const m = s.match(/playlist[/:]([a-zA-Z0-9]+)/);
    if (m) return m[1];
    return /^[a-zA-Z0-9]+$/.test(s) ? s : '';
  }

  // Normaliza lo que el usuario escribe como subdominio (minúsculas, sin espacios/acentos).
  sanitizarSlug(valor: string): string {
    return (valor || '')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  }

  nuevo = {
    nombre: '', slug: '', slogan: '', spotifyPlaylist: '',
    // Administrador del gimnasio: opcional. Si se indica, el backend crea la
    // cuenta con una contraseña temporal (se muestra acá, no se manda por correo).
    adminEmail: '', adminNombre: '', adminIdentificacion: '', adminTelefono: '',
    logo: null as string | null,
    // Plan de suscripción a la plataforma (lo que le cobramos a este
    // gimnasio) — un valor puntual de un plan, no el plan entero.
    // null = sin asignar, válido al crear.
    planPlataformaId: null as string | null,
    planPlataformaCampo: null as string | null,
    colores: { primario: '#0f172a', secundario: '#1d4ed8', fondo: '#eef3ff', navbar: '#0f172a', menu: '#0f172a', dias: '#0f172a' } as Record<string, string>,
    modulos: { rutinas: true, progreso: true, medidas: true, pagos: true, noticias: true, cronometro: true } as Record<string, boolean>
  };

  private get headers() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private gymService: GymService,
    private storage: StorageService
  ) {}

  ngOnInit() {
    this.cargar();
    this.cargarSuperadmins();
    this.cargarDashboard();
    this.cargarPlanesPlataforma();
    this.cargarPagosPlataforma();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarSuperadmins() {
    this.cargandoSuperadmins = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/auth/superadmins`, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => { this.superadmins = data; this.cargandoSuperadmins = false; this.cdr.detectChanges(); },
        error: () => { this.cargandoSuperadmins = false; this.toast.error('Error al cargar superadmins'); }
      });
  }

  crearSuperadmin() {
    if (!this.nuevoSuperadmin.nombre || !this.nuevoSuperadmin.email || this.guardandoSuperadmin) return;
    this.guardandoSuperadmin = true;
    this.http.post<any>(`${environment.apiUrl}/api/auth/superadmins`, this.nuevoSuperadmin, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.guardandoSuperadmin = false;
          this.mostrarFormSuperadmin = false;
          this.passwordTemporalSuperadmin = { email: res.superadmin.email, password: res.passwordTemporal, invitacionEnviada: !!res.invitacionEnviada };
          this.nuevoSuperadmin = { nombre: '', email: '' };
          this.toast.success('Superadmin creado');
          this.cargarSuperadmins();
        },
        error: (err) => { this.guardandoSuperadmin = false; this.toast.error(err?.error?.mensaje || 'Error al crear superadmin'); }
      });
  }

  /** id del superadmin logueado, para saber si "Editar" apunta a su propia cuenta. */
  get miPropioId(): string | null {
    return this.storage.decodeTokenPayload(this.storage.getToken())?.id ?? null;
  }

  /** ojito de mostrar/ocultar, igual que en el login (verPass) */
  verActual = false;
  verNueva = false;

  abrirEditarSuperadmin(s: any) {
    this.editandoSuperadmin = { _id: s._id, nombre: s.nombre, email: s.email, password: '', actual: '' };
    this.verActual = false;
    this.verNueva = false;
  }

  cerrarEditarSuperadmin() {
    this.editandoSuperadmin = null;
  }

  guardarEdicionSuperadmin() {
    if (!this.editandoSuperadmin || this.guardandoSuperadmin) return;
    if (this.editandoSuperadmin.password && this.editandoSuperadmin.password.length < 8) {
      this.toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    // Solo la propia cuenta lleva contraseña, y siempre con la actual escrita:
    // sobre otro superadmin el formulario ni muestra esos campos.
    const editaSuPropiaCuenta = this.editandoSuperadmin._id === this.miPropioId;
    const cambiaPassword = editaSuPropiaCuenta && !!this.editandoSuperadmin.password;
    if (cambiaPassword && !this.editandoSuperadmin.actual) {
      this.toast.error('Escribí tu contraseña actual para cambiarla');
      return;
    }
    this.guardandoSuperadmin = true;
    this.http.put<any>(`${environment.apiUrl}/api/auth/superadmins/${this.editandoSuperadmin._id}`, {
      nombre: this.editandoSuperadmin.nombre,
      email: this.editandoSuperadmin.email,
      ...(cambiaPassword ? {
        password: this.editandoSuperadmin.password,
        actual: this.editandoSuperadmin.actual
      } : {})
    }, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.guardandoSuperadmin = false;
        this.editandoSuperadmin = null;
        this.toast.success('Superadmin actualizado');
        this.cargarSuperadmins();
      },
      error: (err) => { this.guardandoSuperadmin = false; this.toast.error(err?.error?.mensaje || 'Error al editar superadmin'); }
    });
  }

  async eliminarSuperadmin(s: any) {
    const ok = await this.confirm.confirm(`¿Eliminar a "${s.nombre}" como superadmin? Esta acción no se puede deshacer.`);
    if (!ok) return;
    this.http.delete(`${environment.apiUrl}/api/auth/superadmins/${s._id}`, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => { this.toast.success('Superadmin eliminado'); this.cargarSuperadmins(); },
        error: (err) => this.toast.error(err?.error?.mensaje || 'Error al eliminar')
      });
  }

  cargar() {
    this.cargando = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/gym`, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.gyms = data; this.cargando = false; this.cdr.detectChanges(); },
      error: () => { this.cargando = false; this.toast.error('Error al cargar gimnasios'); }
    });
  }

  cargarDashboard() {
    this.http.get<typeof this.dashboard>(`${environment.apiUrl}/api/gym/dashboard`, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => { this.dashboard = data; this.cdr.detectChanges(); },
        error: () => this.toast.error('Error al cargar el dashboard')
      });
  }

  cargarPlanesPlataforma() {
    this.cargandoPlanes = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/planes-plataforma`, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => { this.planesPlataforma = data; this.cargandoPlanes = false; this.cdr.detectChanges(); },
        error: () => { this.cargandoPlanes = false; this.toast.error('Error al cargar los planes'); }
      });
  }

  crearPlanPlataforma() {
    if (!this.nuevoPlan.nombre || this.nuevoPlan.precioMensual == null || this.nuevoPlan.precioPorSuscriptor == null || this.guardandoPlan) return;
    this.guardandoPlan = true;
    this.http.post(`${environment.apiUrl}/api/planes-plataforma`, this.nuevoPlan, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.toast.success('Plan creado');
          this.nuevoPlan = { nombre: '', precioMensual: null, precioPorSuscriptor: null };
          this.nuevoPlanNombrePersonalizado = false;
          this.mostrarFormPlan = false;
          this.guardandoPlan = false;
          this.cargarPlanesPlataforma();
        },
        error: (err) => { this.guardandoPlan = false; this.toast.error(err.error?.error || 'Error al crear el plan'); }
      });
  }

  cargarPagosPlataforma() {
    this.cargandoPagos = true;
    let params = new HttpParams();
    if (this.filtroEstadoPago) params = params.set('estado', this.filtroEstadoPago);
    if (this.filtroDesdePago) params = params.set('desde', this.filtroDesdePago);
    if (this.filtroHastaPago) params = params.set('hasta', this.filtroHastaPago);

    this.http.get<any[]>(`${environment.apiUrl}/api/pagos-plataforma`, { headers: this.headers, params })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => { this.pagosPlataforma = data; this.cargandoPagos = false; this.cdr.detectChanges(); },
        error: () => { this.cargandoPagos = false; this.toast.error('Error al cargar la facturación'); }
      });
  }

  filtrarEstadoPago(estado: typeof this.filtroEstadoPago) {
    this.filtroEstadoPago = estado;
    this.cargarPagosPlataforma();
  }

  abrirFormPago() {
    const hoy = new Date();
    this.nuevoPago = { gymId: '', monto: null, mes: hoy.getMonth() + 1, anio: hoy.getFullYear(), metodo: '' };
    this.mostrarFormPago = true;
  }

  // Al elegir el gimnasio, sugiere el monto según su plan de plataforma
  // asignado — el superadmin lo puede pisar igual, es solo un punto de
  // partida para no tener que ir a mirar la pestaña Planes. En los dos
  // casos es el valor CRUDO del plan (mensual: precioMensual; por
  // suscriptor: precioPorSuscriptor, el valor unitario, sin multiplicar por
  // sociosActivos) — multiplicar acá daba $0 en gimnasios sin socios
  // activos ahora mismo (por ejemplo uno recién reactivado), tapando el
  // precio real de su plan justo cuando más hace falta verlo.
  sugerirMontoPago() {
    const gym = this.gyms.find(g => g._id === this.nuevoPago.gymId);
    if (!gym?.planPlataforma) return;
    if (gym.planPlataformaCampo === 'mensual') {
      this.nuevoPago.monto = Number(gym.planPlataforma.precioMensual);
    } else if (gym.planPlataformaCampo === 'porSuscriptor') {
      this.nuevoPago.monto = Number(gym.planPlataforma.precioPorSuscriptor);
    }
  }

  /**
   * Campo del plan del gimnasio elegido en el formulario — decide si se
   * pide Mes/Año (porSuscriptor, alineado al mes calendario) o si el
   * período es simplemente "un mes desde hoy" (mensual, rodante). Null
   * mientras no se elija ningún gimnasio todavía.
   */
  get campoPagoSeleccionado(): 'mensual' | 'porSuscriptor' | null {
    const gym = this.gyms.find(g => g._id === this.nuevoPago.gymId);
    return gym?.planPlataformaCampo || null;
  }

  /**
   * Vista previa del período que va a cubrir el pago — igual que calcula el
   * backend (que ignora cualquier "fecha"/"hasta" que no le corresponda a
   * este tipo de plan):
   * - porSuscriptor: el mes calendario completo (01 al último día real) del
   *   Mes/Año elegidos.
   * - mensual: un mes rodante desde HOY, sin selector — así se registró
   *   siempre para este tipo de plan, antes de que existiera el "mes guía".
   */
  get periodoPago(): string {
    const fmt = (d: Date) => d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (this.campoPagoSeleccionado === 'mensual') {
      const desde = new Date();
      const hasta = new Date(desde);
      hasta.setMonth(hasta.getMonth() + 1);
      return `${fmt(desde)} al ${fmt(hasta)} (un mes desde hoy)`;
    }
    const { mes, anio } = this.nuevoPago;
    if (!mes || !anio) return '';
    const desde = new Date(anio, mes - 1, 1);
    const hasta = new Date(anio, mes, 0);
    return `${fmt(desde)} al ${fmt(hasta)}`;
  }

  crearPagoPlataforma() {
    if (!this.nuevoPago.gymId || this.nuevoPago.monto == null || this.guardandoPago) return;
    this.guardandoPago = true;
    // El backend solo necesita saber a qué mes cae "fecha" (recalcula el mes
    // calendario completo él solo) — el día 01 alcanza, no hace falta el de
    // hoy ni ninguno en particular.
    const { mes, anio } = this.nuevoPago;
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const payload = { gymId: this.nuevoPago.gymId, monto: this.nuevoPago.monto, metodo: this.nuevoPago.metodo, fecha };
    this.http.post(`${environment.apiUrl}/api/pagos-plataforma`, payload, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.toast.success('Pago registrado');
          this.guardandoPago = false;
          this.mostrarFormPago = false;
          this.cargarPagosPlataforma();
          // Un pago "pagada" extiende la vigencia del gimnasio en el backend —
          // sin este refresco, la tarjeta de Gimnasios se quedaba con la fecha
          // vieja hasta recargar toda la página.
          this.cargar();
        },
        error: (err) => { this.guardandoPago = false; this.toast.error(err.error?.error || 'Error al registrar el pago'); }
      });
  }

  async anularPago(pago: any) {
    // El aviso de "desactiva el gimnasio" solo aplica si el pago YA estaba
    // pagado: anular un "pendiente" (p. ej. un corte automático que el gym
    // no llegó a pagar) no le resta nada al gimnasio, porque nunca le había
    // sumado vigencia — ver el PUT del backend, que solo toca planVenceEn/
    // activo al cruzar la frontera hacia o desde "pagada".
    const advertencia = pago.estado === 'pagada'
      ? ' Esto también desactiva el gimnasio: sus socios y administrador no podrán ingresar hasta que se registre un pago nuevo.'
      : '';
    const ok = await this.confirm.confirm(
      `¿Anular el pago de ${pago.gymNombre} por ${this.formatMoneda(pago.monto)}?${advertencia}`
    );
    if (!ok) return;
    this.http.put(`${environment.apiUrl}/api/pagos-plataforma/${pago._id}`, { estado: 'anulada' }, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.toast.success('Pago anulado');
          this.cargarPagosPlataforma();
          // Anular un pago "pagada" le resta el mes que había sumado —
          // refresca Gimnasios para que la tarjeta lo muestre sin recargar.
          this.cargar();
        },
        error: (err) => this.toast.error(err.error?.error || 'Error al anular el pago')
      });
  }

  /**
   * Confirma el cobro de un "pendiente" — típicamente un corte automático de
   * fin de mes (ver planPlataformaVigencia.js) que el gimnasio ya transfirió.
   * Sin esto no había forma de cerrar esas filas desde la pantalla.
   */
  async marcarPagado(pago: any) {
    const ok = await this.confirm.confirm(
      `¿Confirmar que ${pago.gymNombre} pagó ${this.formatMoneda(pago.monto)}?`
    );
    if (!ok) return;
    this.http.put(`${environment.apiUrl}/api/pagos-plataforma/${pago._id}`, { estado: 'pagada' }, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.toast.success('Pago confirmado');
          this.cargarPagosPlataforma();
          // Pasar a "pagada" le suma vigencia al gimnasio — refrescar
          // Gimnasios para que la tarjeta lo muestre sin recargar.
          this.cargar();
        },
        error: (err) => this.toast.error(err.error?.error || 'Error al confirmar el pago')
      });
  }

  // `campo` decide qué valor se edita: el formulario inline muestra un solo
  // input "Valor" en vez de los dos precios juntos, para que quede claro cuál
  // de los dos se está tocando.
  abrirEditarPlan(plan: any, campo: 'mensual' | 'porSuscriptor') {
    this.editandoPlan = { ...plan };
    this.editandoPlanCampo = campo;
    this.editandoValor = Number(campo === 'mensual' ? plan.precioMensual : plan.precioPorSuscriptor);
    this.mostrarFormPlan = false;
  }

  cerrarEditarPlan() {
    this.editandoPlan = null;
    this.editandoPlanCampo = null;
    this.editandoValor = null;
  }

  guardarEdicionPlan() {
    if (!this.editandoPlan || !this.editandoPlanCampo || this.guardandoPlan) return;
    this.guardandoPlan = true;
    // Solo se manda el campo tocado (más el nombre): el otro precio queda
    // intacto, no hace falta reenviarlo.
    const campoPrecio = this.editandoPlanCampo === 'mensual' ? 'precioMensual' : 'precioPorSuscriptor';
    this.http.put(`${environment.apiUrl}/api/planes-plataforma/${this.editandoPlan._id}`, {
      nombre: this.editandoPlan.nombre,
      [campoPrecio]: this.editandoValor
    }, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Plan actualizado');
        this.editandoPlan = null;
        this.editandoPlanCampo = null;
        this.editandoValor = null;
        this.guardandoPlan = false;
        this.cargarPlanesPlataforma();
        this.cargar(); // el nombre/precio del plan puede mostrarse en las tarjetas de gym
      },
      error: (err) => { this.guardandoPlan = false; this.toast.error(err.error?.error || 'Error al actualizar el plan'); }
    });
  }

  // Borra el plan ENTERO (sus dos recuadros, Mensual y Por suscriptor, son
  // un solo plan) — el backend lo da de baja con soft-delete, así que un
  // gym que lo tenía asignado no se rompe: simplemente deja de facturarle
  // hasta que el superadmin le reasigne otro plan (mismo criterio que ya
  // usan el dashboard y el corte automático con un plan eliminado).
  async eliminarPlanPlataforma(plan: any) {
    const ok = await this.confirm.confirm(
      `¿Eliminar el plan "${plan.nombre}" completo (Mensual y Por suscriptor)? Los gimnasios que lo tengan asignado se quedan sin plan hasta que les asignes otro.`
    );
    if (!ok) return;
    this.http.delete(`${environment.apiUrl}/api/planes-plataforma/${plan._id}`, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.toast.success('Plan eliminado');
          this.cargarPlanesPlataforma();
          this.cargar(); // gyms que lo tenían asignado dejan de mostrarlo
        },
        error: (err) => this.toast.error(err.error?.error || 'Error al eliminar el plan')
      });
  }

  // Asignar/desasignar plan a un gimnasio, desde el selector de tarjetas
  // (crear o editar). Un segundo click sobre la misma tarjeta desasigna.
  // El <select> de plan trabaja con una clave combinada "{id}:{campo}" (un
  // valor puntual, no el plan entero — ver comentario en el schema). Estos
  // dos métodos arman/desarman esa clave para cualquiera de los dos objetos
  // (nuevo o editando), en vez de duplicar la lógica dos veces.
  claveOpcionPlan(obj: { planPlataformaId: string | null; planPlataformaCampo?: string | null }): string | null {
    return obj.planPlataformaId ? `${obj.planPlataformaId}:${obj.planPlataformaCampo}` : null;
  }

  elegirOpcionPlan(obj: { planPlataformaId: string | null; planPlataformaCampo?: string | null }, clave: string | null) {
    if (!clave) {
      obj.planPlataformaId = null;
      obj.planPlataformaCampo = null;
      return;
    }
    const [id, campo] = clave.split(':');
    obj.planPlataformaId = id;
    obj.planPlataformaCampo = campo;
  }

  generarSlug() {
    this.nuevo.slug = this.nuevo.nombre
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  }

  procesarImagen(file: File, callback: (base64: string) => void) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = () => {
      console.error('Error al leer la imagen:', reader.error);
      this.toast.error('Error al leer la imagen');
    };
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;
      img.onerror = () => {
        console.error('Error al cargar la imagen');
        this.toast.error('Error al procesar la imagen');
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        const scale = MAX / Math.max(img.width, img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.85));
        this.cdr.detectChanges();
      };
    };
  }

  onLogoChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.procesarImagen(file, (b64) => this.nuevo.logo = b64);
  }

  onLogoEditChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.procesarImagen(file, (b64) => this.editando.logo = b64);
  }

  abrirEditar(gym: any) {
    this.editando = {
      ...gym,
      colores: { ...gym.colores } as Record<string, string>,
      modulos: { ...gym.modulos } as Record<string, boolean>
    };
    // Simplificación: botones/menú/días siguen al color principal (navbar).
    this.aplicarPrincipal(this.editando, this.editando.colores['navbar'] || '#0f172a');
    this.mostrarForm = false;
    this.cargarAdminsEditando(gym._id);
  }

  cerrarEditar() {
    this.editando = null;
    this.editandoAdmins = null;
    this.nuevoAdminGym = { email: '', nombre: '', identificacion: '', telefono: '' };
  }

  cargarAdminsEditando(gymId: string) {
    this.editandoAdmins = null;
    this.http.get<any[]>(`${environment.apiUrl}/api/gym/${gymId}/admins`, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (admins) => { this.editandoAdmins = admins; this.cdr.detectChanges(); },
        error: () => { this.editandoAdmins = []; this.cdr.detectChanges(); }
      });
  }

  crearAdminGym() {
    if (!this.editando || !this.nuevoAdminGym.email || this.guardandoAdminGym) return;
    this.guardandoAdminGym = true;
    const gymId = this.editando._id;
    this.http.post<any>(`${environment.apiUrl}/api/gym/${gymId}/admin`, this.nuevoAdminGym, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (admin) => {
          this.guardandoAdminGym = false;
          this.adminCreado = { email: admin.email, passwordTemporal: admin.passwordTemporal, invitacionEnviada: !!admin.invitacionEnviada };
          this.nuevoAdminGym = { email: '', nombre: '', identificacion: '', telefono: '' };
          this.cargarAdminsEditando(gymId);
          // Refresca la lista de fondo (totalUsuarios, panel de Información).
          this.cargar();
        },
        error: (err) => { this.guardandoAdminGym = false; this.toast.error(err?.error?.error || 'Error al crear administrador'); }
      });
  }

  /**
   * Le genera al administrador una contraseña temporal nueva y se la manda
   * por correo — para cuando la olvidó y no puede entrar a pedir el reseteo.
   * Reusa la MISMA ruta que crear (`POST /:id/admin`): el backend detecta que
   * el correo ya existe en ese gym y, en vez de duplicarlo, le renueva la
   * contraseña. Por eso la anterior deja de servir apenas se hace esto.
   */
  reinvitarAdminGym(admin: any) {
    if (!this.editando || this.reinvitandoAdminId) return;
    const gymId = this.editando._id;
    this.reinvitandoAdminId = admin._id;

    this.http.post<any>(`${environment.apiUrl}/api/gym/${gymId}/admin`, { email: admin.email }, { headers: this.headers })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.reinvitandoAdminId = null;
          // Misma tarjeta que al crear: si el correo salió no se muestra la
          // contraseña; si falló, queda a la vista para entregarla a mano.
          this.adminCreado = { email: res.email, passwordTemporal: res.passwordTemporal, invitacionEnviada: !!res.invitacionEnviada };
          this.cargarAdminsEditando(gymId);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.reinvitandoAdminId = null;
          this.toast.error(err?.error?.error || 'No se pudo reenviar la invitación');
          this.cdr.detectChanges();
        }
      });
  }

  guardarEdicion() {
    if (!this.editando || this.guardando) return;
    this.guardando = true;

    const gym$ = this.http.put(`${environment.apiUrl}/api/gym/${this.editando._id}/configuracion`, {
      nombre: this.editando.nombre,
      slug: this.editando.slug,
      logo: this.editando.logo,
      slogan: this.editando.slogan,
      colores: this.editando.colores,
      modulos: this.editando.modulos,
      spotifyPlaylist: this.editando.spotifyPlaylist,
      planPlataformaId: this.editando.planPlataformaId,
      planPlataformaCampo: this.editando.planPlataformaCampo
    }, { headers: this.headers });

    // El o los administradores ya existentes se guardan junto con el resto
    // del formulario — un solo botón "Guardar cambios", sin uno aparte por
    // cada admin.
    const admins$ = (this.editandoAdmins || []).map(a =>
      this.http.put(`${environment.apiUrl}/api/gym/${this.editando._id}/admin/${a._id}`, {
        nombre: a.nombre, identificacion: a.identificacion, telefono: a.telefono
      }, { headers: this.headers })
    );

    forkJoin([gym$, ...admins$]).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Gimnasio actualizado');
        this.guardando = false;
        this.editando = null;
        this.cargar();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Error al guardar');
        this.guardando = false;
      }
    });
  }

  async crear() {
    if (!this.nuevo.nombre || !this.nuevo.slug || this.guardando) return;
    this.guardando = true;
    this.http.post(`${environment.apiUrl}/api/gym/crear`, this.nuevo, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        // El gimnasio se crea aunque el admin falle: hay que distinguirlo, o
        // el superadmin creería que ya tiene acceso.
        const admin = res?.admin;
        if (!admin) {
          this.toast.success('Gimnasio creado');
        } else if (admin.error) {
          this.toast.error(`Gimnasio creado, pero el administrador no: ${admin.error}`);
        } else {
          // La contraseña temporal se muestra una sola vez: toast no alcanza
          // (se autodesaparece), hace falta una tarjeta que quede a la vista.
          this.toast.success('Gimnasio creado');
          this.adminCreado = { email: admin.email, passwordTemporal: admin.passwordTemporal, invitacionEnviada: !!admin.invitacionEnviada };
        }
        this.mostrarForm = false;
        this.nuevo = { nombre: '', slug: '', slogan: '', spotifyPlaylist: '', adminEmail: '', adminNombre: '', adminIdentificacion: '', adminTelefono: '', logo: null,
          planPlataformaId: null, planPlataformaCampo: null,
          colores: { primario: '#0f172a', secundario: '#1d4ed8', fondo: '#eef3ff', navbar: '#0f172a', menu: '#0f172a', dias: '#0f172a' } as Record<string, string>,
          modulos: { rutinas: true, progreso: true, medidas: true, pagos: true, noticias: true, cronometro: true } as Record<string, boolean>
        };
        this.guardando = false;
        this.cargar();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Error al crear');
        this.guardando = false;
      }
    });
  }

  async toggleActivo(gym: any) {
    const accion = gym.activo ? 'desactivar' : 'activar';
    const participio = gym.activo ? 'desactivado' : 'activado';
    const ok = await this.confirm.confirm(`¿${accion} "${gym.nombre}"?`);
    if (!ok) return;
    this.http.patch(`${environment.apiUrl}/api/gym/${gym._id}/estado`,
      { activo: !gym.activo }, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success(`Gimnasio ${participio}`); this.cargar(); },
      error: (err) => this.toast.error(err?.error?.error || 'Error al cambiar estado')
    });
  }

  async eliminar(gym: any) {
    const ok = await this.confirm.confirm(`¿Eliminar permanentemente "${gym.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    this.http.delete(`${environment.apiUrl}/api/gym/${gym._id}`, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Gimnasio eliminado'); this.cargar(); },
      // El backend explica el motivo real (p. ej. "tiene usuarios activos");
      // mostrarlo evita el genérico que no dice nada.
      error: (err) => this.toast.error(err?.error?.error || 'Error al eliminar')
    });
  }

  // --- Panel "Información" de cada tarjeta de gimnasio ---
  moduloLabels: Record<string, string> = {
    rutinas: 'Rutinas', progreso: 'Progreso', medidas: 'Medidas',
    pagos: 'Pagos', noticias: 'Noticias', cronometro: 'Cronómetro'
  };

  modulosActivos(gym: any): string[] {
    if (!gym?.modulos) return [];
    return Object.keys(gym.modulos)
      .filter(k => gym.modulos[k])
      .map(k => this.moduloLabels[k] || k);
  }

  toggleInfo(gym: any) {
    gym.infoAbierta = !gym.infoAbierta;
    if (gym.infoAbierta && !gym.admins) {
      this.http.get<any[]>(`${environment.apiUrl}/api/gym/${gym._id}/admins`, { headers: this.headers })
        .pipe(takeUntil(this.destroy$)).subscribe({
        next: (admins) => { gym.admins = admins; this.cdr.detectChanges(); },
        error: () => { gym.admins = []; this.cdr.detectChanges(); }
      });
    }
  }

  cerrarSesion() {
    this.auth.logout();
    // El superadmin no pertenece a ningún gimnasio, así que no hay ninguna
    // marca "suya" que conservar en el login — a diferencia de un socio o
    // admin cerrando sesión de SU gym (ahí sí se preserva a propósito, ver
    // clearSessionPreservingData). Sin esto, el login de después mostraba la
    // marca de cualquier gimnasio que se hubiera visitado antes en este
    // navegador (ej. probando Total Gym), en vez de la de la plataforma.
    this.gymService.limpiarGym();
    // No a /sa: es la pantalla "Panel Central" vestigial de antes del login
    // universal. El superadmin ya se loguea por el mismo /login que todos.
    this.router.navigate(['/login']);
  }
}
