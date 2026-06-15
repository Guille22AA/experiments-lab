from fastapi import FastAPI
from pydantic import BaseModel
import joblib
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Inicializamos la app
app = FastAPI(title="API Sentiment Analysis")

# 2. Cargamos el modelo entrenado
model = joblib.load("sentiment_model.pkl")

# 3. Base de datos (SQLite)
DATABASE_URL = "sqlite:///./predictions.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

# 4. Definimos la tabla
class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String)
    prediction = Column(String)

# 5. Creamos la base de datos
Base.metadata.create_all(bind=engine)

# 6. Esquema de entrada (lo que manda el usuario)
class TextInput(BaseModel):
    text: str

# 7. Endpoint raíz (opcional, pero útil)
@app.get("/")
def read_root():
    return {"status": "API funcionando correctamente"}

# 8. Endpoint de predicción
@app.post("/predict")
def predict_sentiment(data: TextInput):
    db = SessionLocal()

    # Predicción
    result = model.predict([data.text])[0]

    # Guardamos en BD
    prediction = Prediction(
        text=data.text,
        prediction=result
    )
    db.add(prediction)
    db.commit()
    db.close()

    return {
        "text": data.text,
        "prediction": result
    }

# 9. Endpoint para ver historial
@app.get("/history")
def get_history():
    db = SessionLocal()
    results = db.query(Prediction).all()
    db.close()

    return [
        {
            "id": r.id,
            "text": r.text,
            "prediction": r.prediction
        }
        for r in results
    ]
