import { HttpClient } from '@angular/common/http';
import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { Observable } from 'rxjs';

// Representa un método de pago del gimnasio.
// Campos opcionales para no romper a los llamadores existentes.
export interface Metodo {
    _id?: string;
    gymId?: string;
    titulo?: string;
    tipo?: string;
    imagenUrl?: string;
    descripcion?: string;
    datosClave?: string;
    /** Link de cobro del gimnasio. Si está, el socio ve un botón para pagar. */
    enlace?: string;
    activo?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

/** Una sede con lo suyo dentro del período. */
export interface FilaSede {
    _id: string | null;
    nombre: string;
    esPrincipal: boolean;
    /** Lo que de verdad entró en el período. */
    cobrado: number;
    pagos: number;
    sociosActivos: number;
}

/** Un mes del historial. */
export interface MesFacturado {
    desde: string;
    hasta: string;
    cobrado: number;
    pagos: number;
}

/** Lo cobrado en el período, abierto por plan. */
export interface FilaPlan {
    _id: string | null;
    nombre: string;
    cobrado: number;
    pagos: number;
}

export interface Facturacion {
    desde: string;
    hasta: string;
    /** El admin de un local ve solo el suyo. */
    soloSuSede: boolean;
    sedes: FilaSede[];
    planes: FilaPlan[];
    total: { cobrado: number; pagos: number; sociosActivos: number };
}

@Injectable({
    providedIn: 'root'
})
export class PagosService {
    // La URL será: http://localhost:3000/api/pagos
    private API_URL: string = `${environment.apiUrl}/api/pagos`;

    constructor(private http: HttpClient) { }

    /**
     * Lo facturado en un mes, abierto por sede.
     *
     * El período se calcula acá y viaja como instantes: el servidor corre en
     * UTC y el gimnasio no, así que un "mes" armado allá se correría de día.
     */
    facturacion(anio: number, mes: number): Observable<Facturacion> {
        const desde = new Date(anio, mes, 1).toISOString();
        const hasta = new Date(anio, mes + 1, 1).toISOString();
        return this.http.get<Facturacion>(`${environment.apiUrl}/api/transacciones/facturacion`,
            { params: { desde, hasta } });
    }

    /**
     * Los últimos `cuantos` meses terminando en el elegido. Los cortes se
     * calculan acá, en el reloj del dispositivo, por lo mismo que el período.
     */
    historialMeses(anio: number, mes: number, cuantos = 6): Observable<{ meses: MesFacturado[] }> {
        const cortes: string[] = [];
        for (let i = cuantos - 1; i >= 0; i--) cortes.push(new Date(anio, mes - i, 1).toISOString());
        cortes.push(new Date(anio, mes + 1, 1).toISOString());
        return this.http.get<{ meses: MesFacturado[] }>(
            `${environment.apiUrl}/api/transacciones/facturacion/meses`,
            { params: { cortes: cortes.join(',') } });
    }

    // Obtener todos los métodos (Lo usará el Socio y el Admin)
    obtenerMetodos(): Observable<Metodo[]> {
        return this.http.get<Metodo[]>(this.API_URL);
    }

    // Crear un nuevo método (Solo para el Admin)
    crearMetodo(datos: Metodo): Observable<Metodo> {
        return this.http.post<Metodo>(this.API_URL, datos);
    }

    // Actualizar un método existente
    actualizarMetodo(id: string, datos: Metodo): Observable<Metodo> {
        return this.http.put<Metodo>(`${this.API_URL}/${id}`, datos);
    }

    // Eliminar un método
    eliminarMetodo(id: string): Observable<Metodo> {
        return this.http.delete<Metodo>(`${this.API_URL}/${id}`);
    }
}