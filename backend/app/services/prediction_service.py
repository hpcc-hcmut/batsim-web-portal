"""
Prediction Service - Transform workloads with predicted job durations.

This service integrates ML models for predicting job execution times,
allowing schedulers to make better decisions based on predicted durations
rather than user-provided estimates.

Phase 1 Implementation: Mock predictions (walltime * 0.9)
Phase 2 (Graduation Project): Real ML model integration
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.prediction_model import PredictionModel, PredictionMode, ModelType

logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    """Result of predicting duration for a single job."""
    job_id: str
    original_walltime: float
    predicted_duration: float
    confidence: float = 0.0


class PredictionService:
    """
    Transform workload jobs with predicted durations using ML models.

    Supports three modes:
    - NO_PREDICTION: Return original workload unchanged
    - PREDICTION_ONLY: Replace walltime with predicted_duration
    - HYBRID: Add predicted_duration field alongside original walltime
    """

    def __init__(self):
        self._loaded_models: Dict[int, Any] = {}  # Cache for loaded models

    def _get_model(self, model_id: int, db: Session) -> Optional[PredictionModel]:
        """Get prediction model from database."""
        return db.query(PredictionModel).filter(
            PredictionModel.id == model_id,
            PredictionModel.is_active == True
        ).first()

    def _load_model(self, model_path: str) -> Any:
        """Load ML model from joblib file."""
        try:
            import joblib
            return joblib.load(model_path)
        except ImportError:
            logger.warning("joblib not installed, using mock predictions")
            return None
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {e}")
            return None

    def _extract_features(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Extract prediction features from job metadata."""
        return {
            "requested_resources": job.get("res", 1),
            "requested_walltime": job.get("walltime", 3600),
            "submission_time": job.get("subtime", 0),
            "profile_type": job.get("profile", "default"),
        }

    def _predict_mock(self, job: Dict[str, Any]) -> PredictionResult:
        """
        Generate mock prediction (placeholder for real ML model).

        Strategy: Predict 90% of requested walltime with some variation.
        This simulates the common case where users over-estimate job duration.
        """
        job_id = str(job.get("id", "unknown"))
        walltime = float(job.get("walltime", 3600))

        # Mock prediction: 80-95% of requested walltime
        import random
        factor = random.uniform(0.80, 0.95)
        predicted = walltime * factor

        return PredictionResult(
            job_id=job_id,
            original_walltime=walltime,
            predicted_duration=round(predicted, 2),
            confidence=0.85  # Mock confidence
        )

    def _predict_with_model(
        self,
        job: Dict[str, Any],
        model: Any,
        features_config: List[str]
    ) -> PredictionResult:
        """Generate prediction using loaded ML model."""
        job_id = str(job.get("id", "unknown"))
        walltime = float(job.get("walltime", 3600))

        try:
            # Extract features based on model's feature config
            features = self._extract_features(job)
            feature_vector = [features.get(f, 0) for f in features_config]

            # Make prediction
            predicted = model.predict([feature_vector])[0]

            return PredictionResult(
                job_id=job_id,
                original_walltime=walltime,
                predicted_duration=max(1.0, round(float(predicted), 2)),
                confidence=0.90
            )
        except Exception as e:
            logger.warning(f"Prediction failed for job {job_id}: {e}, using mock")
            return self._predict_mock(job)

    async def transform_workload(
        self,
        workload_path: str,
        model_id: Optional[int],
        mode: PredictionMode,
        output_dir: str,
    ) -> str:
        """
        Transform workload by adding/replacing job durations with predictions.

        Args:
            workload_path: Path to original workload JSON file
            model_id: ID of prediction model to use (None for mock)
            mode: How to apply predictions (NO_PREDICTION, PREDICTION_ONLY, HYBRID)
            output_dir: Directory to write transformed workload

        Returns:
            Path to transformed workload file
        """
        # No transformation if prediction disabled
        if mode == PredictionMode.NO_PREDICTION:
            logger.debug("Prediction disabled, returning original workload")
            return workload_path

        # Load original workload
        try:
            with open(workload_path, 'r') as f:
                workload = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load workload from {workload_path}: {e}")
            return workload_path

        # Get model if specified
        model = None
        features_config = ["requested_resources", "requested_walltime"]
        if model_id:
            db = SessionLocal()
            try:
                model_record = self._get_model(model_id, db)
                if model_record and model_record.model_path:
                    if model_record.model_type != ModelType.MOCK:
                        model = self._load_model(model_record.model_path)
                        if model_record.features:
                            features_config = json.loads(model_record.features)
            finally:
                db.close()

        # Transform jobs
        jobs = workload.get("jobs", [])
        transformed_jobs = []
        predictions_log = []

        for job in jobs:
            if model:
                prediction = self._predict_with_model(job, model, features_config)
            else:
                prediction = self._predict_mock(job)

            predictions_log.append({
                "job_id": prediction.job_id,
                "original": prediction.original_walltime,
                "predicted": prediction.predicted_duration,
                "confidence": prediction.confidence,
            })

            # Apply prediction based on mode
            transformed_job = job.copy()
            if mode == PredictionMode.PREDICTION_ONLY:
                transformed_job["walltime"] = prediction.predicted_duration
            elif mode == PredictionMode.HYBRID:
                transformed_job["predicted_duration"] = prediction.predicted_duration
                transformed_job["prediction_confidence"] = prediction.confidence

            transformed_jobs.append(transformed_job)

        # Update workload
        workload["jobs"] = transformed_jobs
        workload["prediction_metadata"] = {
            "mode": mode.value,
            "model_id": model_id,
            "total_jobs": len(jobs),
            "predictions_applied": len(predictions_log),
        }

        # Write transformed workload
        output_filename = f"workload_predicted.json"
        output_path = os.path.join(output_dir, output_filename)

        with open(output_path, 'w') as f:
            json.dump(workload, f, indent=2)

        # Also save predictions log for analysis
        log_path = os.path.join(output_dir, "predictions_log.json")
        with open(log_path, 'w') as f:
            json.dump(predictions_log, f, indent=2)

        logger.info(f"Transformed workload with {len(predictions_log)} predictions -> {output_path}")
        return output_path

    async def preview_transformation(
        self,
        workload_path: str,
        model_id: Optional[int],
        mode: PredictionMode,
        sample_size: int = 5
    ) -> Dict[str, Any]:
        """
        Preview how predictions would transform a workload (without writing files).

        Returns:
            Preview dict with sample jobs and transformation summary
        """
        try:
            with open(workload_path, 'r') as f:
                workload = json.load(f)
        except Exception as e:
            return {"error": f"Failed to load workload: {e}"}

        jobs = workload.get("jobs", [])[:sample_size]
        previews = []

        for job in jobs:
            prediction = self._predict_mock(job)
            previews.append({
                "job_id": prediction.job_id,
                "original_walltime": prediction.original_walltime,
                "predicted_duration": prediction.predicted_duration,
                "confidence": prediction.confidence,
                "mode": mode.value,
            })

        return {
            "total_jobs": len(workload.get("jobs", [])),
            "sample_size": len(previews),
            "mode": mode.value,
            "model_id": model_id,
            "samples": previews,
        }


# Global singleton instance
prediction_service = PredictionService()
