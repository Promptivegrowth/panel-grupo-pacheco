# Portal administrativo · Grupo Pacheco

Un solo portal para las webs de **Laboratorios Pacheco**, **Q-Medical** y **WOLI**.
Se elige la empresa, se ingresa con el usuario correspondiente y se gestiona:

| Módulo | Qué hace | Empresas |
|---|---|---|
| Libro de reclamaciones | Hojas registradas desde la web, PDF, respuesta y control del plazo de 15 días hábiles | Las tres |
| Mensajes de contacto | Lo que llega por los formularios de contacto y cotización | Las tres |
| Datos de la web | WhatsApp, teléfonos, correos, dirección, horario y redes; se ven en la web al recargar | Las tres |
| Trabaja con nosotros | Vacantes publicadas en la web | Laboratorios Pacheco |

## Roles

- **maestro** — todos los módulos de las empresas asignadas.
- **empleos** — solo «Trabaja con nosotros».

Los permisos se aplican en tres capas: el proxy exige sesión, cada página y acción
comprueba empresa y rol (`src/lib/sesion.ts`) y, al final, la base de datos los
vuelve a imponer con RLS (`supabase/migrations/0001_esquema.sql`).

## Cómo encajan las webs

Las tres webs son estáticas (Vercel o cPanel) y hablan con este portal y con Supabase:

```
web (estática) ──lee── Supabase REST (clave publicable, solo lo publicado)
      │
      └─envía─▶ portal /api/publico/{empresa}/reclamo | contacto
                   └─ valida, numera, genera el PDF, guarda y envía los correos
```

- **Lectura**: datos de contacto y vacantes, con la clave publicable. La RLS solo deja ver lo visible y vigente.
- **Escritura**: los formularios nunca escriben directo en la base; pasan por la API del
  portal, que usa la clave de servicio. CORS limitado a los dominios de cada empresa
  (columna `empresas.origenes`), campo trampa anti-robots y límite de envíos por IP anonimizada.

## Libro de reclamaciones

- Numeración correlativa por empresa y año: `LP-000001-2026`, `QM-…`, `WO-…` (función `siguiente_correlativo`).
- Plazo: 15 días hábiles sin fines de semana ni feriados nacionales (`src/lib/reclamos/plazos.ts`).
  Los feriados extraordinarios no se pueden prever: la fecha es una referencia.
- PDF de la Hoja de Reclamación (`src/lib/reclamos/pdf.ts`), guardado en el bucket privado `reclamos`.
  Se regenera al responder, con la sección 4 completa.
- Correos: constancia al consumidor (con el PDF), aviso interno y, al responder, la respuesta.
  Si el correo no está configurado, todo se guarda igual y se puede reenviar desde el reclamo.
- Los reclamos no se pueden borrar desde el portal (registro legal).
- El domicilio lleva ubigeo INEI (departamento, provincia y distrito). El portal valida
  el código y resuelve los nombres en el servidor (`src/lib/ubigeo.ts`); el monto se
  guarda con su moneda (PEN o USD).

### Ubigeo

`scripts/ubigeo.py` genera `src/lib/ubigeo-peru.json` (25 departamentos, 196 provincias,
1892 distritos, INEI 2026) y copia el mismo archivo a `public/data/ubigeo-peru.json` de
las tres webs, que lo usan para los selectores en cascada. Si el INEI crea un distrito,
se añade en el script y se vuelve a ejecutar: portal y webs quedan siempre iguales.

## Desarrollo

```bash
cp .env.example .env.local        # y completar
npm install
node scripts/migrar.mjs           # aplica supabase/migrations/ pendientes (0001–0005)
npm run dev                       # http://localhost:3000
```

### Usuarios

```bash
node scripts/usuarios.mjs crear --correo gerencia@… --rol maestro --empresas lp,qmedical,woli
node scripts/usuarios.mjs crear --correo rrhh@…     --rol empleos --empresas lp
node scripts/usuarios.mjs clave  --correo gerencia@…              # nueva contraseña
node scripts/usuarios.mjs correo --correo viejo@… --nuevo nuevo@…
node scripts/usuarios.mjs listar
```

## Despliegue (Vercel)

1. Importar el repositorio en Vercel (se detecta Next.js).
2. Variables de entorno: las de `.env.example` **salvo** `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_REF`.
3. Añadir el dominio del portal y, en las webs, apuntar el endpoint de formularios a ese dominio.

> Next.js 16: el antiguo `middleware.ts` se llama `proxy.ts`, y `cookies()`, `params` y
> `searchParams` son asíncronos. Ver `AGENTS.md`.
