# PROMPT — AUDITORÍA Y OPTIMIZACIÓN PROFESIONAL DE KYNARI

Actúa como Senior Technical SEO, SEO Strategist, AEO Specialist, Growth Engineer, especialista en performance, CRO, contenido, accesibilidad y seguridad web.

## SITIO
- Dominio / URL canónica: **https://kynari.dev/**
- Sitio HTML estático multi-página: `index`, `servicios`, `sobre-mi`, `proyectos`, `contacto`, `faq`, `noticias`. Sin build system, sin package manager, sin test suite.
- Entidad: **Kynari** (ciberseguridad & desarrollo seguro). Idioma: `es-ES`.
- Toda metadata absoluta (canonical, og:url, JSON-LD, sitemap) debe apuntar a `https://kynari.dev/…` con la extensión `.html` real de cada página.

## MODO DIFERENCIAL
Este sitio ya fue auditado y optimizado en iteraciones previas (SEO técnico, metadata, sitemap, JSON-LD base, favicon, parches JS ya aplicados).
- Ignora lo que ya es correcto. No re-reportes hallazgos P0/P1 ya resueltos.
- Reporta solo hallazgos nuevos o regresiones respecto al estado actual del repositorio.
- Cada hallazgo debe citar evidencia concreta: archivo y línea, o resultado de una comprobación que hayas ejecutado.

## METODOLOGÍA
**AUDITAR → DETECTAR → PRIORIZAR → IMPLEMENTAR → VALIDAR → DOCUMENTAR**

Inspecciona primero el repositorio real. No te limites a recomendar: implementa en código todo lo que sea posible y seguro.

## OBJETIVOS
- Construir autoridad de Kynari.
- Ser descubierto por personas que todavía no conocen la marca.
- Captar tráfico orgánico.
- Mejorar SEO y AEO.
- Facilitar la comprensión por buscadores y sistemas de IA.
- Convertir visitas en contactos, clientes o acciones relevantes.

## AUDITAR

### Discovery
Identifica problemas, necesidades, búsquedas, casos de uso, oportunidades de contenido, landings y distribución social que puedan llevar usuarios hacia Kynari sin necesidad de búsquedas de marca.

### Search Intent
Clasifica oportunidades en:
- informacional;
- comercial;
- transaccional;
- navegacional;
- problem-aware;
- solution-aware;
- brand-aware.

Relaciona cada intención con una página o contenido real.

### SEO técnico
Audita e implementa cuando corresponda:
- robots.txt;
- sitemap.xml;
- canonical;
- index/noindex;
- redirects;
- URLs;
- titles y descriptions;
- headings;
- HTML semántico;
- internal linking;
- páginas huérfanas;
- duplicados;
- imágenes y alt;
- rendering;
- SSR/SSG/ISR;
- Core Web Vitals;
- errores HTTP;
- indexabilidad.

### Accessibility (a11y)
Audita e implementa: landmarks (`header`/`nav`/`main`/`footer`), enlace "saltar al contenido", jerarquía de headings, foco visible, `focus trap` en menús móviles y modales, contraste AA, `alt` en imágenes, `<label>` asociado a cada input, `aria-expanded`/`aria-controls` en acordeones, cierre de menú con Escape, soporte de `prefers-reduced-motion`.

### AEO
Haz explícito:
- qué es Kynari;
- qué hace;
- para quién;
- qué problemas resuelve;
- productos/servicios reales;
- cómo contactar.

Usa estructura clara y machine-readable.

### Entity SEO / Structured Data
Evalúa Schema.org:
- Organization;
- WebSite;
- WebPage;
- BreadcrumbList;
- Article;
- Service;
- SoftwareApplication, si aplica.

Los datos deben coincidir con información visible y real.

### Contenido
Crea estrategia basada en problemas, preguntas, necesidades, casos de uso y autoridad temática. Evita contenido creado solo para rellenar keywords.
Base cualquier propuesta de contenido en páginas, servicios y textos ya existentes en el repo. No inventes keywords de búsqueda ni volúmenes: sin datos reales, limítate a señalar qué secciones nuevas derivan de contenido visible y márcalo como acción manual cuando requiera investigación de keywords o acceso a Search Console.

### Internal Linking
Construye una arquitectura lógica entre home, servicios/productos, contenidos y conversión. Detecta páginas importantes con pocos o ningún enlace interno.

### Performance
Audita JavaScript, imágenes, fuentes, CSS, requests, bundles, lazy loading, caching y rendering. Prioriza móvil y conexiones lentas. Este repo es estático y sin build: no busques tooling ni pipeline de build que no exista.

### Conversión
Audita propuesta de valor, CTA, formularios, navegación, confianza y fricción.

### Analytics
Define eventos para adquisición, páginas de entrada, clics, formularios, contactos, CTA y conversiones.

### Social Discovery
Analiza oportunidades para Instagram, Facebook, LinkedIn y otras plataformas relevantes. Prioriza contenido que resuelva necesidades, no solamente promoción de marca.

### Indexación
Determina qué debe indexarse y qué debe quedar fuera. No afirmes indexación sin comprobarla.

### Seguridad
Audita secretos, variables de entorno, endpoints, formularios, headers, dependencias y exposición de información. Nunca publiques secretos.

## PRIORIZACIÓN
Clasifica hallazgos:
- **P0 — crítico**
- **P1 — alto**
- **P2 — medio**
- **P3 — mejora**

Para cada uno: problema, impacto, evidencia, solución, dificultad y prioridad.

## IMPLEMENTACIÓN Y VALIDACIÓN
Implementa todo lo posible desde código. Regla de mínima intervención: usa el cambio más corto que resuelva el hallazgo. No reescribas HTML, CSS o JS que funciona sin un hallazgo concreto que lo justifique. Respeta el estilo, los comentarios y las convenciones existentes.

Validación concreta sobre código estático (sin servidor ni tooling externo):
- El JSON-LD debe parsear como JSON válido y coincidir con contenido visible en la página.
- Cada `href` interno, `canonical` y referencia a asset debe corresponder a un archivo existente en el repo. Detecta enlaces rotos y páginas huérfanas.
- El sitemap debe listar solo páginas reales e indexables; `robots.txt` no debe bloquear páginas canónicas.
- No declares algo implementado si no fue comprobado.

## ACCIONES MANUALES
Si se necesita Google Search Console, Analytics, dominio/DNS, hosting, redes, APIs u otra plataforma, no inventes acceso.

Entrega al final:

### ACCIONES MANUALES PENDIENTES
1. Plataforma.
2. Objetivo.
3. Paso a paso exacto.
4. Valor exacto, si aplica.
5. Dónde obtenerlo.
6. Cómo verificarlo.
7. Estado.

## RESTRICCIONES
Nunca inventes estadísticas, keywords, backlinks, indexación, citas de IA, servicios, resultados o datos. No expongas secretos.

## INFORME FINAL
1. Resumen ejecutivo.
2. Discovery.
3. Search Intent.
4. SEO técnico.
5. Metadata.
6. AEO.
7. Entity SEO.
8. Structured Data.
9. Contenido.
10. Internal Linking.
11. Performance.
12. Conversión.
13. Analytics.
14. Social Discovery.
15. Indexación.
16. Seguridad.
17. Cambios realizados.
18. Archivos modificados.
19. Validaciones.
20. Pendientes.
21. Acciones manuales.
22. Roadmap P0/P1/P2/P3.

**Objetivo:** NECESIDAD → DISCOVERY → SEARCH/SEO → AEO/IA → KYNARI → EXPLORACIÓN → CONFIANZA → CONVERSIÓN
