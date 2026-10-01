# Especificación del proyecto (resumen fiel del documento original)

> Fuente: `prompt_app_compra_menus.pdf` (Guille, 2026-10-01). Este archivo es la referencia
> para cualquier sesión futura. Si algo no está aquí, decidir con sentido común siguiendo su espíritu.
>
> **Cambios acordados con Guille (2026-10-01), mandan sobre el PDF:**
> - **Sin modo offline real**: nada de service worker, IndexedDB ni sincronización. Basta con **exportar la lista** (texto .txt, compartir/copiar, imprimir).
> - **Sin importación de vídeos**: las recetas vistas en vídeos se cuentan por texto al chat ("he visto una receta de tal, apúntala como variación del plato X").
> - La privacidad del nivel gratuito de Gemini no le preocupa.

## 1. Contexto
- Autor: Guille, estudiante de programación (GitHub: guille22aa). Uso personal + portfolio.
- Puede comercializarse algún día: **no sobrediseñar**, pero no cerrar esa puerta.
- **Presupuesto cero**: nada de servicios de pago (IA, hosting, BD).

## 2. Qué hace la app
- Entrevista inicial con IA (gustos, restricciones, hábitos).
- Despensa con niveles aproximados.
- Ciclos "de compra a compra": tras cada compra propone un menú hasta la siguiente.
- Lista de la compra por secciones del súper, exportable (texto/imprimir) para llevarla al súper.
- Recetario personal ("memoria de cocina"): recetas de la IA, contadas por mí, importadas de enlaces o contadas en el chat.
- Asistente IA siempre disponible que responde y **propone cambios que yo confirmo**.
- Aprende de mis valoraciones.

## 3. Stack y arquitectura
- Frontend: React + Vite, móvil primero (manifest para "añadir a pantalla de inicio"). ~~Offline con IndexedDB~~ descartado.
- Backend: Node + Express. Intermediario con la IA y APIs externas (Open Food Facts, descarga de enlaces).
- API keys **solo** en `backend/.env`. `.env.example` documentado; `.env` en `.gitignore`.
- BD: SQLite (better-sqlite3) con capa de acceso a datos separada e intercambiable.
- Despliegue: local en el PC; móvil por red local (`vite --host`); en el súper, la lista exportada.
- Preparado para desplegar: config por variables de entorno, sin URLs a mano.
- Sin login (un usuario). Autenticación = "Future work" en el README.

## 4. IA
### 4.1 Proveedor intercambiable
- `aiService` abstrae el proveedor; nadie más llama a un proveedor concreto.
- `AI_PROVIDER`, `AI_MODEL` + key por env.
- Primero Gemini (nivel gratuito, modelo Flash: lee imágenes y PDF para tickets).
- Preparado para Claude, Groq, Ollama con la misma interfaz.

### 4.2 Ahorro de llamadas
- Lo que se pueda hacer con código **no** usa IA: filtros de restricciones, lista, despensa, ciclos, nutrición (OFF).
- IA solo para: onboarding, menús, sustituciones y chat, extracción de recetas (texto/enlace), tickets, detección de cambios de perfil.
- Nunca historiales enteros ni toda la BD: contexto resumido por tarea.
- Errores de límite/caída: mensajes claros y amables; la app sigue funcionando sin IA.

### 4.3 Respuestas estructuradas
- Todo lo que alimente la app se pide en JSON con esquema y se **valida con zod**.
- JSON inválido → 1 reintento → error claro sin romper nada.

### 4.4 Memoria
- La memoria vive en la BD (perfil, despensa, recetario+valoraciones, historial de menús y cocinados, chat).
- `contextBuilder` selecciona y resume según tarea. Ej.: menú → perfil, restricciones, despensa, recetas relevantes con valoraciones, platos de últimos ciclos. Chat desde el menú del jueves → perfil resumido, esa receta, despensa, últimos mensajes.

### 4.5 Papeles: entrevistador, planificador, lector (tickets, enlaces, recetas contadas), chat con acciones.

### 4.6 Acciones del asistente (siempre con confirmación)
- La IA **nunca** modifica datos: devuelve texto + acciones JSON.
- Tipos mínimos: `replace_meal`, `move_meal`, `update_profile`, `add_to_shopping_list`, `remove_from_shopping_list`, `update_pantry`, `save_recipe`, `log_cooked_meal` (también fuera de menú, descontando despensa).
- Tarjeta de confirmación legible: "¿Cambiar la cena del jueves por tortilla de patatas? [Aceptar] [Rechazar]".
- Detecta cambios de perfil en la conversación ("ya no me gusta el pescado") → `update_profile`.
- Historial de acciones con **deshacer** (guardar datos para revertir).
- Las acciones pasan por las validaciones de restricciones.

### 4.7 Asistente contextual
- Botón flotante en todas las pantallas; sabe desde dónde se abre y usa ese contexto.
- Ej.: "no me queda X, ¿con qué lo sustituyo?" → sustitución realista con la despensa + acción si hace falta.

## 5. Onboarding
- Entrevista por chat natural y adaptativa (no formulario fijo).
- Mínimo: restricciones/alergias/intolerancias; gustos y disgustos (platos, ingredientes, cocinas); ganas de cocinar y tiempo (entre semana / fin de semana); habilidad; utensilios; comidas a planificar y nº de personas; batch cooking y sobras; frecuencia de compra (def. 7 días); supermercado (Mercadona).
- Resumen final para confirmar/corregir.
- Perfil estructurado en BD, editable desde Ajustes y desde el chat (`update_profile`).
- Onboarding repetible desde Ajustes.

## 6. Restricciones (CRÍTICO)
- Filtros **duros validados en código**, no solo instrucciones a la IA.
- Ingredientes/recetas con etiquetas (gluten, lácteos, origen animal, frutos secos...). Alérgenos de OFF cuando existan + diccionario propio.
- Antes de mostrar o guardar cualquier menú/receta/sustitución de la IA, comprobar. Si viola: descartar y pedir otra, o como mínimo aviso muy visible.
- Si hay dudas (sin datos): **avisar**, no dar por bueno.

## 7. Despensa
- Niveles: se acabó / poco / medio / mucho. Sin cantidades exactas ni caducidades.
- Agrupada por secciones del súper.
- Actualización: manual cómoda en móvil (buscar/añadir, tocar para cambiar nivel, deslizar para quitar); por ticket (foto o PDF de Mercadona → IA extrae → emparejar con productos conocidos o crear → **siempre revisión antes de guardar**); al cocinar (propone bajar niveles, con confirmación); desde el chat (`update_pantry`).
- Productos "aprendidos": la primera vez se asigna sección y etiquetas; luego se reconocen.

## 8. Ciclos y menús
### 8.1 Ciclo
- Compra normal → ciclo nuevo → actualizar despensa → proponer menú.
- Duración por defecto 7 días, cambiable al generar. Con el tiempo, media real de días entre compras.
- Compra pequeña a mitad de ciclo: suma a despensa, **no** abre ciclo; ofrece reajustar con IA los días restantes.
- Si se acaba el menú sin comprar: ofrecer estirarlo con lo que quede.

### 8.2 Generación
- Entradas: perfil, restricciones, despensa, recetario+valoraciones, platos de ciclos anteriores, días y comidas.
- Reglas: priorizar despensa (nivel alto o que lleve tiempo); repetir poco (si repite, variaciones); rápidos entre semana, largos con tiempo; usar lo bien valorado, evitar lo que no gustó; si un producto tiene receta ligada, proponer esa receta; batch cooking si interesa; sobras marcadas como tales.
- Además, recomendaciones de compra → lista de la compra.

### 8.3 Gestión
- Vista por días y comidas. Cambiar plato (alternativas IA o del recetario), mover (arrastrar o menú), marcar cocinado/comido o saltado, ver receta.
- Al cocinar: historial + proponer descontar despensa + pedir valoración.
- Platos fuera de menú también al historial (app o chat).

### 8.4 Valoraciones (NO estrellas)
- Opciones rápidas: "Me ha encantado, repítela" / "Bien, pero tarda demasiado" / "No me ha quedado rica / no la propongas más" / "Ajustar: más rápida / menos picante / más sencilla..." + nota libre.
- Se guarda si es la primera vez.
- La IA las usa (no repetir lo que no gustó, lo lento a días con tiempo o versión rápida, repetir lo que encantó, aplicar ajustes).

## 9. Lista de la compra
- Desde recomendaciones del menú; editable (añadir, quitar, cantidad aproximada). También desde despensa ("se acabó → a la lista") y chat.
- Por secciones de Mercadona en orden de recorrido (editables): Fruta y verdura, Carne, Pescado, Charcutería y quesos, Panadería, Lácteos y huevos, Despensa, Conservas, Congelados, Bebidas, Droguería y limpieza, Higiene.
- Modelo con varios supermercados y sus secciones.
- En el súper: tocar para tachar; lo tachado baja al final de su sección.
- Exportar: archivo .txt, texto (Web Share API / portapapeles) y vista imprimible.
- **Nada de scraping** de ningún súper.

## 10. Recetario
### 10.1 Campos
Nombre, descripción, ingredientes (cantidades aproximadas), pasos, tiempo, dificultad, raciones, utensilios, etiquetas (rápida, batch, sobras, cocina...), etiquetas de restricciones, origen (IA, mía, chat, enlace), enlace, favorita, valoraciones, historial de cocinado. Variaciones ligadas a receta base.

### 10.2 Formas de añadir
IA al proponer menús (se guardan al usarse o valorarse); formulario; contadas informalmente en el chat (la IA estructura, pregunta solo lo imprescindible, enseña y guarda al confirmar); enlace web (primero JSON-LD schema.org Recipe, si no IA sobre el texto, siempre con revisión); texto pegado. **Vídeos: no se importan**, se cuentan por texto en el chat, y se puede pedir guardarlas como variación de una receta existente.

### 10.3 Recetas ligadas a producto
Receta ligada a un producto (yatekomos → "mi ramen"). Si está en la despensa, la IA propone la receta, no el producto tal cual.

## 11. Info saludable y precios (fase final)
- Open Food Facts (por nombre o código de barras): Nutri-Score, azúcares/grasas/sal, NOVA, alérgenos. Avisos sencillos ("Este zumo es casi todo azúcar"). Caché en BD.
- Precios solo aproximados (míos o estimados). Nada de scraping.

## 12. Diseño
- Minimalista y usable: Fitts (zonas táctiles grandes, navegación abajo), Hick (pocas opciones), Jakob (patrones conocidos), proximidad, feedback (confirmaciones, cargas, deshacer).
- Claro/oscuro: sigue el sistema + interruptor manual guardado. Colores con variables CSS desde el principio.
- Barra inferior: **Menú · Despensa · Lista · Recetas**. Ajustes en la cabecera.
- Botón flotante del asistente (panel, o pantalla completa en móvil) con contexto de pantalla.
- Tarjetas de acciones bien visibles en el chat.
- Interfaz en español. Accesibilidad básica (contraste, legibilidad, etiquetas en botones de icono).

## 13. Modelo de datos
Ver `docs/ARCHITECTURE.md` (versión definitiva).

## 14. Fuera de alcance (→ "Future work" del README)
Notificaciones/recordatorios; login y multiusuario; despliegue en internet; scraping; cantidades exactas y caducidades; funciones para comercializar.

## 15. Estilo de código
- Legible para un junior, bien comentado, simple. Sin abstracciones innecesarias salvo `aiService`, `contextBuilder` y capa de datos.
- Frontend y backend separados, nombres consistentes.
- Identificadores y comentarios en **inglés**; interfaz en **español**.
- Validación en backend y errores claros. Sin secretos en el repo.

## 16. README
En inglés y conciso: qué es, capturas, funcionalidades, stack, instalar/arrancar (incl. móvil en red local), variables de entorno (→ `.env.example`), cambiar de proveedor IA, Future work.

## 17. Fases
1. Base (frontend, backend, SQLite, .env), aiService+Gemini, contextBuilder básico, chat, onboarding y perfil (con Ajustes).
2. Despensa (manual, niveles, secciones) + compras con ticket y revisión. Ciclos.
3. Menú del ciclo con todas sus reglas; gestión (cambiar, mover, cocinado, sobras, batch); restricciones como filtros duros.
4. Lista de la compra (recomendaciones, editable, secciones, exportar .txt/compartir/imprimir).
5. Recetario completo (variaciones, ligadas a producto, importar texto/enlace, variaciones contadas en el chat) + valoraciones que influyen.
6. Acciones del asistente con tarjetas, detección de cambios de perfil, historial y deshacer, asistente contextual.
7. Open Food Facts (con caché) y precios aproximados.
8. Pulido (usabilidad, temas, accesibilidad), revisión y README.

## 18. Cómo trabajar
- Avanzar sin preguntar a cada paso; preguntar solo ante bloqueos o decisiones grandes.
- Al acabar cada fase: qué se hizo, cómo probarlo, decisiones importantes.
- Si algo del documento es un problema (técnico, seguridad, coste), avisar y proponer alternativa.
