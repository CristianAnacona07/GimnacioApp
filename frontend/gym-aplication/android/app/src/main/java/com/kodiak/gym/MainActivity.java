package com.kodiak.gym;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android le pasa al WebView el ajuste de "tamaño de letra" del sistema
        // en forma de textZoom. En un celular con letra grande (1.3x, que es lo
        // que trae de fábrica más de un Huawei) la raíz del documento pasa de
        // 16px a 20.8px, y como casi todo el diseño está en rem, crece en
        // cascada hasta descuadrar la pantalla.
        //
        // Esto NO se arregla desde CSS: textZoom multiplica incluso los tamaños
        // escritos en px fijos, así que forzar font-size en el <html> no cambia
        // nada (probado en el celular: se le pide 16px y sigue midiendo 20.8px).
        // El único lugar donde se puede desactivar es acá.
        //
        // Con 100 el WebView respeta los tamaños que dice el CSS y la app se ve
        // igual en cualquier celular, como en la web.
        this.bridge.getWebView().getSettings().setTextZoom(100);
    }
}
