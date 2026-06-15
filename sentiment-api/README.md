# API de Análisis de Sentimiento (FastAPI + Docker + Azure)

Este proyecto es una **API sencilla de análisis de sentimiento** desarrollada con Python y FastAPI. La idea principal es tener un backend funcional, dockerizado y desplegado en la nube (Azure), simulando un entorno real de trabajo como los que piden muchas empresas para prácticas o primeros puestos junior.

No es un proyecto "académico" al uso, sino algo práctico, pensado para aprender **backend + cloud + un poco de IA**, partiendo de una base tecnológica normal (DAW).

---

##  ¿Qué hace la API?

* Recibe un texto
* Analiza si el sentimiento es **positivo o negativo** (modelo muy simple)
* Guarda el resultado en una base de datos
* Permite consultar el historial de predicciones

---

##  Tecnologías usadas

* **Python 3**
* **FastAPI** (API REST)
* **SQLite** (persistencia simple)
* **Docker** (contenedor)
* **Docker Hub** (almacenamiento de la imagen)
* **Azure App Service** (despliegue en la nube)
* **Swagger UI** (documentación y pruebas)

---

##  Estructura del proyecto

```
PROYECTO API/
├── app.py
├── requirements.txt
├── Dockerfile
├── predictions.db   (no se sube al repo)
├── venv/             (no se sube al repo)
└── README.md
```

---

##  Ejecutar el proyecto en local

### 1️ Crear entorno virtual

```bash
python -m venv venv
```

Activar:

* Windows:

```bash
venv\Scripts\activate
```

---

### 2️ Instalar dependencias

```bash
pip install -r requirements.txt
```

---

### 3️ Lanzar la API

```bash
uvicorn app:app --reload
```

La API estará disponible en:

```
http://127.0.0.1:8000
```

Swagger:

```
http://127.0.0.1:8000/docs
```

---

##  Ejecutar con Docker

### Build de la imagen

```bash
docker build -t api-sentiment .
```

### Ejecutar contenedor

```bash
docker run -p 8000:8000 api-sentiment
```

---

##  Despliegue en Azure

La imagen está subida a Docker Hub y desplegada en **Azure App Service (Linux + Docker)**.

### URL pública de la API

```
https://api-sentiment-guillermoaparicio-dnf6atacabbvcyd5.spaincentral-01.azurewebsites.net/
```

### Swagger en producción

```
https://api-sentiment-guillermoaparicio-dnf6atacabbvcyd5.spaincentral-01.azurewebsites.net/docs
```

---

##  Endpoints principales

### GET `/`

Comprueba que la API está funcionando.

Respuesta:

```json
{"status":"API funcionando correctamente"}
```

---

### POST `/predict`

Analiza el sentimiento de un texto.

Ejemplo de body:

```json
{
  "text": "me ha encantado este producto"
}
```

Respuesta:

```json
{
  "text": "me ha encantado este producto",
  "prediction": "positivo"
}
```

---

### GET `/history`

Devuelve el historial de predicciones guardadas.

---

##  Notas

* La base de datos es **SQLite**, pensada solo para pruebas.
* En un entorno real se usaría una base de datos externa.
* El modelo de IA es sencillo, el objetivo es demostrar **integración**, no precisión.

---

##  Objetivo del proyecto

* Practicar desarrollo backend real
* Aprender Docker desde cero
* Entender cómo se despliega una API en Azure
* Tener un proyecto presentable para prácticas

---

##  Autor

Guillermo Aparicio

Proyecto personal de aprendizaje
