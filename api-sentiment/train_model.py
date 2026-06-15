import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import joblib

# 1. Datos de ejemplo (muy simples)
data = {
    "text": [
        "me encanta este producto",
        "esto es horrible",
        "muy buen servicio",
        "no me gusta nada",
        "excelente experiencia",
        "pésima atención",
        "estoy muy satisfecho",
        "es una basura",
        "me ha gustado mucho",
        "no lo recomiendo"
    ],
    "label": [
        "positivo",
        "negativo",
        "positivo",
        "negativo",
        "positivo",
        "negativo",
        "positivo",
        "negativo",
        "positivo",
        "negativo"
    ]
}

# 2. Convertimos los datos en un DataFrame
df = pd.DataFrame(data)

# 3. Creamos un pipeline:
#    - Convierte texto en números (TF-IDF)
#    - Aplica un modelo de regresión logística
model = Pipeline([
    ("vectorizer", TfidfVectorizer()),
    ("classifier", LogisticRegression())
])

# 4. Entrenamos el modelo
model.fit(df["text"], df["label"])

# 5. Guardamos el modelo entrenado en un archivo
joblib.dump(model, "sentiment_model.pkl")

print("Modelo entrenado y guardado como sentiment_model.pkl")
