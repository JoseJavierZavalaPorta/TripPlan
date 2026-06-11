# Evaluacion del LLM — Golden Set

TripPlan usa el LLM en dos momentos distintos:

- **Agente planificador** (`runPlanningAgent`): chat multi-turno que propone una ruta de ciudades
- **Generacion de itinerario** (`generateDayItems`): genera las actividades de un dia concreto en JSON

---

## Criterios de evaluacion

Para cada caso se evaluan tres dimensiones:

| Dimension | Descripcion | Peso |
|---|---|---|
| **Estructura** | El output es JSON valido y respeta el schema esperado | 33% |
| **Coherencia** | El contenido tiene sentido para el caso de uso (ciudad correcta, restricciones respetadas) | 33% |
| **Calidad** | Informacion especifica y util, no generica ni repetida | 34% |

Puntuacion por caso: PASS / PARTIAL / FAIL

---

## Casos del Agente Planificador

### Caso 1 — Propuesta directa cuando el usuario da destinos concretos

**Input del usuario:**
```
"Quiero visitar España, Italia y Francia en 21 dias. Empezar en Madrid y terminar en Paris."
```

**Output esperado:** `type: "proposal"` con `cityAssignments` de exactamente 21 dias, empezando en Madrid y terminando en Paris. El modelo no debe hacer preguntas adicionales.

**Asserts:**
- `parsed.type === "proposal"`
- `cityAssignments.length === 21`
- `cityAssignments[0].city === "Madrid"`
- `cityAssignments[20].city === "Paris"`
- No hay patron A→B→A en los assignments (validado por `normalizeAssignments()`)

**Resultado observado:** PASS — el modelo propone directamente sin preguntas cuando el usuario ya especifica los destinos.

---

### Caso 2 — Excursion de dia no genera ciudad separada

**Input del usuario:**
```
"Quiero ir a Europa 14 dias. Incluir Oxford y Versalles."
```

**Output esperado:** Oxford aparece como dia dentro de Londres, Versalles como dia dentro de Paris. No deben ser entradas separadas en `cityAssignments`.

**Asserts:**
- No hay `{city: "Oxford"}` en `cityAssignments`
- No hay `{city: "Versalles"}` en `cityAssignments`
- El campo `summary` menciona Oxford y Versalles como excursiones
- Londres tiene 2 o mas dias, Paris tiene 2 o mas dias

**Resultado observado:** PARTIAL — con el prompt mejorado el modelo lo respeta en aproximadamente el 70% de los casos. La funcion `normalizeAssignments()` corrige el 30% restante colapsando el patron `Londres → Oxford → Londres` a `Londres (3d)`.

---

### Caso 3 — Restriccion de costo respetada

**Input del usuario:**
```
"Europa 20 dias. Suiza es muy cara, solo quiero pasar 1 noche maximo."
```

**Output esperado:** Suiza aparece con exactamente 1 dia en `cityAssignments`.

**Asserts:**
- `cityAssignments.filter(a => a.country === "Suiza").length === 1`
- El campo `summary` refleja la restriccion de costo

**Resultado observado:** PASS — el modelo respeta la restriccion tras el ajuste del prompt con la seccion `MANEJO DE RESTRICCIONES`.

---

### Caso 4 — Limite de preguntas

**Input del usuario (inicio de conversacion):**
```
"__start__"
```

**Comportamiento esperado:** El agente hace maximo 2 preguntas antes de proponer el plan. Si el historial ya registra 2 mensajes de tipo `question`, el siguiente response debe ser `type: "proposal"`.

**Asserts:**
- En la tercera interaccion, `parsed.type === "proposal"`
- No se genera una tercera pregunta

**Resultado observado:** PASS — el contador `agentQuestionCount` embebido en el prompt fuerza la transicion a propuesta.

---

### Caso 5 — Normalizador de ciudades duplicadas

**Input simulado** (output del modelo antes del post-procesado):
```
[Madrid(1d), Toledo(1d), Madrid(1d), Valencia(2d)]
```

**Assert sobre `normalizeAssignments()`:**
```typescript
const result = normalizeAssignments([
  { day: 1, city: "Madrid",   country: "Espana", flag: "ES" },
  { day: 2, city: "Toledo",   country: "Espana", flag: "ES" },
  { day: 3, city: "Madrid",   country: "Espana", flag: "ES" },
  { day: 4, city: "Valencia", country: "Espana", flag: "ES" },
  { day: 5, city: "Valencia", country: "Espana", flag: "ES" },
]);

assert(result.filter(a => a.city === "Madrid").length === 3);  // Madrid absorbe Toledo
assert(result.filter(a => a.city === "Toledo").length === 0);  // Toledo eliminado
assert(result.length === 5);                                    // total de dias conservado
```

**Resultado observado:** PASS — el normalizador colapsa el patron A→B→A correctamente en todos los casos probados.

---

## Casos de Generacion de Itinerario

### Caso 6 — JSON valido y schema completo

**Prompt enviado:** Dia 3 en Roma, 8 items solicitados.

**Asserts:**
```typescript
const items = JSON.parse(rawOutput);
assert(Array.isArray(items));
assert(items.length >= 6 && items.length <= 10);
items.forEach(item => {
  assert(typeof item.position === "number");
  assert(
    ["activity", "meal", "transport", "rest", "accommodation", "free_time"]
      .includes(item.itemType)
  );
  assert(typeof item.title === "string" && item.title.length > 0);
  assert(/^\d{2}:\d{2}$/.test(item.startTime));
  assert(/^\d{2}:\d{2}$/.test(item.endTime));
  assert(typeof item.estimatedCost === "number");
  assert(item.currency === "EUR");
});
```

**Resultado observado:** PASS — el modelo respeta el schema. La funcion `repairJsonArray()` recupera los casos en que el JSON queda truncado por el limite de tokens.

---

### Caso 7 — Dia de traslado entre ciudades

**Configuracion:** `prevCity = "Barcelona"`, `city = "Paris"` (mas de 600 km, corresponde vuelo).

**Asserts:**
- `items[0].itemType === "transport"`
- `items[0].title` contiene "Barcelona" y "Paris"
- Los items con posicion mayor a 1 tienen `locationName` en Paris, no en Barcelona
- Al menos un item tiene el titulo comenzando con "Tarde:" o "Noche:"

**Resultado observado:** PASS — la clausula `TRAVEL REQUIRED` en el prompt produce el dia dividido de forma consistente.

---

### Caso 8 — Sin repeticion de locationName

**Configuracion:** Dia 2 en Roma. `visitedLocations` incluye "Coliseo Romano", "Foro Romano", "Restaurante La Pergola".

**Assert:**
```typescript
const newLocations = items.map(i => i.locationName).filter(Boolean);
const alreadyVisited = ["Coliseo Romano", "Foro Romano", "Restaurante La Pergola"];
const repeats = newLocations.filter(loc => alreadyVisited.includes(loc));
assert(repeats.length === 0, `Lugares repetidos: ${repeats.join(", ")}`);
```

**Resultado observado:** PARTIAL — en viajes largos de mas de 15 dias el modelo ocasionalmente repite nombres genericos. El sistema lo mitiga enviando los ultimos 40 lugares visitados en el campo `CRITICAL — LOCATIONS ALREADY USED` del prompt.

---

## Resumen de resultados

| # | Caso | Resultado |
|---|---|---|
| 1 | Propuesta directa con destinos explicitos | PASS |
| 2 | Excursion de dia no genera ciudad separada | PARTIAL |
| 3 | Restriccion de costo respetada | PASS |
| 4 | Limite de 2 preguntas | PASS |
| 5 | Normalizador A→B→A | PASS |
| 6 | JSON valido y schema completo | PASS |
| 7 | Dia de traslado entre ciudades | PASS |
| 8 | Sin repeticion de locationName | PARTIAL |

Score global: 6/8 PASS, 2/8 PARTIAL, 0/8 FAIL

---

## Estrategias de mitigacion implementadas

| Problema detectado | Solucion |
|---|---|
| Modelo repite ciudades o crea patron A→B→A | `normalizeAssignments()` post-procesado |
| JSON truncado por limite de tokens | `repairJsonArray()` + reintento con prompt minimo |
| Agente hace mas de 2 preguntas | Contador `agentQuestionCount` embebido en prompt |
| Actividades repetidas entre dias | Lista `visitedLocations` con los ultimos 40 lugares en el prompt |
| Excursiones generadas como ciudades separadas | Lista de 16 excursiones conocidas en el prompt con instruccion de absorberlas |
| Dia de traslado sin actividades en ciudad destino | Clausulas `TRAVEL REQUIRED` y `THIS IS A SPLIT DAY` en el prompt |
