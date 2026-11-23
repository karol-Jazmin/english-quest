# English Quest

**[▶ Jugar en línea](https://eduarux.github.io/english-quest-v1/)** (en GitHub Pages es modo práctica: las respuestas no se guardan; para guardarlas y usar el panel, ejecuta `app.py`).

Juego pixelado con panel de administración y base de datos SQLite. No necesita instalar nada: solo Python 3.8 o superior.

## Cómo ejecutarlo

    python3 app.py

- Juego para estudiantes: http://localhost:8000/
- Panel de la profesora: http://localhost:8000/admin
  - Usuario: `admin`, clave: `admin123` (cámbiala en la pestaña Administradores)

Variables opcionales: `PORT`, `HOST` (usa `0.0.0.0` para abrirlo en la red del aula), `DB_PATH`.
La base de datos `english_quest.db` se crea sola la primera vez, con los 4 mundos del guion.

## Qué puede hacer la administradora
- Resultados: lista de estudiantes (nombre, ciclo, curso), detalle de cada pregunta con cada respuesta e intento, filtros, exportar a CSV.
- Por pregunta: porcentaje de acierto a la primera y promedio de intentos.
- Mundos y preguntas: crear, editar, ordenar y eliminar mundos; cambiar fondo, medalla, mensaje y el personaje guía de cada mundo; editar preguntas y respuestas (2 a 4 opciones).
- Textos: título, subtítulo, instrucciones y mensaje final.
- Administradores: crear otros administradores o profesoras, cambiar claves, eliminar.

## Estudiantes
Al inicio escriben nombre completo, ciclo y curso y crean su personaje. Recorren los mundos y responden (si fallan, reintentan). Al terminar cada mundo sus respuestas se guardan automáticamente en la base de datos, así que la profesora ve el avance aunque no lleguen al final.
Las respuestas correctas nunca se envían al navegador del estudiante: se validan en el servidor.

## Publicarlo para que todo se guarde (PythonAnywhere, gratis)
1. Crea una cuenta gratis en pythonanywhere.com (tu usuario será parte de la dirección: `USUARIO.pythonanywhere.com`).
2. Pestaña **Consoles → Bash** y ejecuta: `git clone https://github.com/Eduarux/english-quest-v1.git`
3. Pestaña **Web → Add a new web app → Manual configuration → Python 3.10**.
4. En esa misma pestaña abre el archivo **WSGI configuration file**, borra todo y pega (cambia `USUARIO`):

        import sys
        path = '/home/USUARIO/english-quest-v1'
        if path not in sys.path:
            sys.path.insert(0, path)
        from eq_wsgi import application

5. Pulsa **Reload**. El juego queda en `https://USUARIO.pythonanywhere.com/` y el panel en `/admin`.
6. Entra al panel y **cambia la clave `admin123` de inmediato**.
7. Cada 3 meses entra a la pestaña Web y pulsa **Run until 3 months from today** para que no se apague.
