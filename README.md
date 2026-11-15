# Gestión de Artículos de Pesca (Web App / PWA)

Aplicación web progresiva (instalable en **Android** y **PC**) para gestionar stock, ventas y clientes con historial de compras y sincronización en tiempo real entre múltiples dispositivos.

## Funcionalidades Principales

1. **Nueva Venta (Punto de Venta)**:
   - Buscador instantáneo y filtro por categorías (*Reels, Cañas, Mosquetones, Anzuelos, Señuelos, Líneas y Tanzas, Plomadas y Boyas*).
   - Selección de artículos y cantidades con cálculo automático del **Precio Total** y descuento opcional.
   - Asignación de cliente existente o alta rápida en el momento.
   - Descuento automático del stock al confirmar la venta.
   - **Comprobante para WhatsApp**: Genera el resumen detallado listo para enviar por WhatsApp en un toque o copiar al portapapeles.

2. **Control de Stock e Inventario**:
   - Listado de artículos con cantidad actual, precio de venta y **alertas visuales de stock bajo** (`stock <= stock mínimo`).
   - Botones de ajuste rápido (`-1`, `+1`, `+ Ingreso`) para cargar mercadería nueva en segundos.
   - Filtro exclusivo de artículos con stock bajo o agotados.

3. **Clientes e Historial de Operaciones**:
   - Agenda de clientes con teléfono/WhatsApp, cantidad de compras y monto total histórico.
   - **Historial detallado por cliente**: Al tocar cualquier cliente se listan todas sus compras anteriores con fecha, artículos llevados, cantidades, precios y botón para reenviar el comprobante por WhatsApp.

4. **Sincronización Multi-Dispositivo**:
   - **Modo Servidor en Vivo (Incluido)**: Actualización instantánea en todos los dispositivos conectados mediante Server-Sent Events (`/api/events`).
   - **Modo Nube Supabase (Opcional 24/7)**: Permite vincular una base de datos gratuita de Supabase desde el botón **Sincronizado** en la barra superior (usando el script [supabase-schema.sql](file:///c:/Users/Matias/Desktop/app/supabase-schema.sql)).

---

## Cómo iniciar en tu PC

```bash
npm start
```

- **En la PC**: abrí `http://localhost:3000`
- **En celulares Android (misma red Wi-Fi)**: abrí `http://192.168.0.234:3000` en Chrome y tocá **"Instalar aplicación"** o **Menú (⋮) → Agregar a la pantalla principal**.

## Cómo subirla gratis a la nube (para usar con datos móviles 4G/5G desde cualquier lugar)

- **Opción A (Todo en uno en Render.com o Railway.app)**: Subí esta carpeta a un repositorio de GitHub y creá un *Web Service* en Render o Railway. El comando de inicio es `npm start` y todos tus dispositivos entrarán al mismo enlace `https://...` sincronizados en vivo.
- **Opción B (Supabase Cloud)**: Creá un proyecto gratuito en [Supabase](https://supabase.com), ejecutá el contenido de [supabase-schema.sql](file:///c:/Users/Matias/Desktop/app/supabase-schema.sql) en el *SQL Editor*, y pegá tu `Project URL` y `Anon Key` dentro del botón **Sincronizado** de la aplicación.
