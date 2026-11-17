# Cartografía Náutica y Validación Costa/Agua — MarinOS

> **AVISO DE SEGURIDAD NÁUTICA OBLIGATORIO**  
> **CARTA REFERENCIAL — NO APTA PARA NAVEGACIÓN OFICIAL.**  
> Esta aplicación y sus capas cartográficas no reemplazan las cartas náuticas oficiales publicadas por el **Servicio Hidrográfico y Oceanográfico de la Armada de Chile (SHOA)** ni el equipamiento de puente certificado (ECDIS/Plotter homologado, compás magnético calibrado, radar y ecosonda). La navegación por los canales de Chiloé y aguas interiores de la Patagonia exige verificación permanente por el Capitán al mando.

---

## 1. Fuentes Cartográficas Utilizadas en MarinOS

MarinOS opera bajo una arquitectura híbrida optimizada para funcionamiento offline en zonas aisladas sin cobertura 4G/5G:

| Capa | Proveedor / Origen | Rol en MarinOS | Disponibilidad Offline | Limitaciones Críticas |
| :--- | :--- | :--- | :--- | :--- |
| **Mapa Base Vectorial** | Carto Dark Matter (OpenStreetMap) | Relieve costero, siluetas de islas y topografía terrestre referencial | Pre-cacheadas en Service Worker (`sw.js`) | No contiene sondas batimétricas ni isolíneas de profundidad oficiales. |
| **Seamarks Náuticas** | OpenSeaMap (`tiles.openseamap.org`) | Capa raster de ayudas a la navegación (balizas, boyas laterales IHO B, faros, sectores de luz) | Caché agresivo (Cache-First) en `sw.js` | Las marcas provienen de relevamientos colaborativos voluntarios. No debe utilizarse como única fuente de posición de ayudas flotantes. |
| **Fondeaderos y Tenederos** | Base local MarinOS (`anchorages_spatial` en Dexie) | Coordenadas WGS84 de caletas abrigadas, tipo de fondo y protección de viento en Seno de Reloncaví y Chiloé | 100% Offline (IndexedDB persistente) | Verificados en cartas SHOA, pero las condiciones del fondo marino pueden variar tras temporales o movimiento de cultivos acuícolas. |
| **Radio Comunidad** | Reportes locales de capitanes (`community_reports`) | Novedades tácticas de fondeo, alertas de garreo y restricciones de calado con TTL de 24h | Sincronización P2P / Local-First con expiración automática | Son observaciones subjetivas de otros navegantes; deben contrastarse siempre con la sonda de a bordo. |

---

## 2. Cartas Náuticas Oficiales de Referencia (SHOA)

Para cualquier travesía en la X Región de Los Lagos (Seno de Reloncaví, Golfo de Ancud y Archipiélago de Chiloé), el navegante debe portar a bordo las siguientes cartas oficiales vigentes del SHOA:

1. **SHOA 7100**: Seno de Reloncaví (Escala 1:100.000). Cobertura desde Puerto Montt y Calbuco hasta la boca del Estero Reloncaví y Paso Queullín.
2. **SHOA 7111**: Puerto Montt y Canal Tenglo (Escala 1:10.000). Detalle de bajos, banco Tenglo, marina Chinquihue y accesos portuarios.
3. **SHOA 7112**: Paso Queullín y accesos a Calbuco (Escala 1:25.000 / 1:50.000).
4. **SHOA 7200**: Golfo de Ancud (Escala 1:150.000). Navegación troncal hacia Quemchi, Mechuque y Dalcahue.
5. **SHOA 7220**: Archipiélago de las Desertores y Canales Chauques (Escala 1:50.000).
6. **SHOA 7300**: Golfo Corcovado y accesos sur a Chiloé (Escala 1:150.000).

---

## 3. Reglas de Validación Costa / Agua (Land-Crossing Prevention)

MarinOS implementa validaciones estrictas para garantizar que ninguna ruta, waypoint o derrota simulada cruce polígonos terrestres:

### 3.1 Derrota Predeterminada Chiloé (`getDefaultChiloeGPX`)
- **Origen:** Marina Chinquihue / Puerto Montt (`-41.4880, -72.9850`).
- **Canal Tenglo:** Desembocadura sur hacia Seno de Reloncaví librando el Banco Tenglo (`-41.5120, -72.9580`).
- **Aguas Abiertas del Seno:** Derrota en aguas con profundidades superiores a 40 metros, navegando al este de Isla Maillen y al este de Isla Puluqui, librando los bajos de Chaulinec y Calbuco (`-41.6850, -72.8250`).
- **Paso Queullín:** Navegación por el canal central profundo entre Punta Chocoi y Queullín (`-41.8850, -72.8950`).
- **Golfo de Ancud y Chauques:** Rango libre de obstáculos hasta ingresar por el canal de acceso este a Caleta Mechuque (`-42.3125, -73.2680`).

### 3.2 Criterios de Validación Algorítmica
1. **Verificación de Profundidad Teórica:** Toda derrota planificada debe mantener un colchón de agua bajo la quilla de al menos $1.5 \times \text{calado máximo}$ durante la bajamar de sicigia más baja pronosticada.
2. **Margen de Seguridad Costero:** Ningún waypoint de derrota troncal se ubicará a menos de $0.3\text{ NM}$ (aprox. 550 metros) de la línea de bajamar de costa rocosa sin balizamiento, salvo en aproximaciones a muelles o caletas de fondeo.
3. **Resguardo de Concesiones Acuícolas:** En las aguas de Chiloé y Seno de Reloncaví, existen cientos de centros de cultivo de salmón y mitílidos. Las derrotas de MarinOS evitan las zonas de fondeo de boyarines perimetrales manteniendo un resguardo visual mínimo de 100 metros.

---

## 4. Dinámica Hidrográfica y Riesgos Específicos de Chiloé

### 4.1 Amplitudes de Marea Extremas (6 a 7.2 Metros)
- En el Seno de Reloncaví y Golfo de Ancud, la marea es semidiurna con una amplitud vertical que alcanza regularmente los **6.0 a 7.2 metros** en sicigia (lunas llena y nueva).
- **Consecuencia náutica:** Una caleta con 8 metros de profundidad en pleamar quedará reducida a apenas 1.0 a 1.5 metros en bajamar. Embarcaciones con calado superior a 1.8 metros pueden quedar varadas en seco si el patrón no calcula la marea con tablas SHOA o el módulo de marea de MarinOS.
- **Régimen de Fondeo:** El filado de cadena debe calcularse siempre con respecto a la **pleamar máxima**:
  $$\text{Cadena a filar} = \text{Ratio (ej. 5:1)} \times (\text{Sonda en bajamar} + \text{Amplitud de marea} + \text{Altura de la proa sobre el agua})$$

### 4.2 Corrientes de Marea Violentas
1. **Canal Chacao:**  
   - Velocidades de corriente de hasta **8.5 a 9.0 nudos**.  
   - Peligros mortales de rompientes y remolinos gigantes en Bajo Seluian y Roca Remolinos.  
   - **Regla de oro:** Cruce o navegación exclusiva en la estoa (Slack Water) o con marea a favor si la potencia del motor garantiza maniobra segura.
2. **Paso Queullín y Paso Alao:**  
   - Corrientes de **4.0 a 6.0 nudos** en el embudo formado entre las islas. Genera mar confusa y olas escarpadas cuando el viento se opone a la corriente ("viento contra corriente").

### 4.3 Fenómenos Meteorológicos Locales
1. **El Temporal del Norte / Noroeste (Travesía):**  
   - Vientos sostenidos de 25 a 45 nudos previos a frentes fríos.  
   - Mar picada de período muy corto en el Seno de Reloncaví.  
   - Provoca garreo violento en tenederos de cascajo suelto o piedra lisa.  
   - *Refugios recomendados:* Caleta La Arena (fondo de fango compacto), esteros profundos orientados al sur.
2. **El Viento Puelche (Catabático del Este):**  
   - Desciende súbitamente de la Cordillera de los Andes por los fiordos (Estero Reloncaví, Fiordo Comau).  
   - Ráfagas secas muy violentas que pueden sobrepasar los 50 nudos con cielo completamente despejado.  
   - *Refugios recomendados:* Ensenadas con protección cerrada al este (ej. Caleta Poyo margen este resguardado, o sotavento de islas altas).

---

## 5. Protocolo de Emergencia por Pérdida de Navegación Electrónica

En caso de fallo de batería, pantalla mojada o pérdida de señal GNSS en aguas interiores:
1. **Gobernar de Inmediato a Aguas Abiertas y Profundas:** Si se navega en un canal angosto con corriente fuerte, busque el centro del canal guiándose por marcas visuales de costa.
2. **Fondeo Preventivo:** Si la profundidad lo permite ($<25\text{ m}$), fondear inmediatamente fuera de la línea de navegación comercial o remolcadores con trenes de cultivo.
3. **Comunicaciones VHF:** Establecer guardia permanente en **Canal 16 VHF** y reportar a la Autoridad Marítima local (Alcaldía de Mar o Capitanía de Puerto de Puerto Montt, Castro o Calbuco).
