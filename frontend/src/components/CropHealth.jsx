import React from "react";
import { Camera } from "lucide-react";

export const CropHealth = ({
  diseaseImage,
  diseaseResult,
  isAnalyzing,
  onImageUpload,
  onClearImage,
}) => {
  return (
    <div className="health-tab">
      <div className="upload-box">
        <input
          type="file"
          accept="image/*"
          onChange={onImageUpload}
          id="imageUpload"
          hidden
        />
        <label htmlFor="imageUpload" className="upload-label">
          {diseaseImage ? (
            <img src={diseaseImage} alt="Plant" className="preview-image" />
          ) : (
            <div className="upload-placeholder">
              <Camera size={48} />
              <p>Click to upload plant image</p>
            </div>
          )}
        </label>
        {diseaseImage && (
          <button className="clear-btn" onClick={onClearImage}>
            Upload New Image
          </button>
        )}
      </div>

      {isAnalyzing && (
        <div className="analyzing">
          <div className="spinner"></div>
          <p>Analyzing plant health...</p>
        </div>
      )}

      {diseaseResult && !isAnalyzing && (
        <div className="disease-result">
          <div
            className={`result-header ${diseaseResult.severity.toLowerCase()}`}
          >
            <h2>{diseaseResult.name}</h2>
            <span className="confidence">
              {diseaseResult.confidence}% Confidence
            </span>
          </div>
          <p className="description">{diseaseResult.description}</p>

          {diseaseResult.causes.length > 0 && (
            <div className="section">
              <h4>Causes:</h4>
              <ul>
                {diseaseResult.causes.map((cause, i) => (
                  <li key={i}>{cause}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="section">
            <h4>Treatment:</h4>
            <ol>
              {diseaseResult.treatment.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {diseaseResult.prevention && (
            <div className="section">
              <h4>Prevention:</h4>
              <p>{diseaseResult.prevention}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
