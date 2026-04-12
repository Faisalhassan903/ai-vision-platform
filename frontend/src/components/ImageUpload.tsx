import { useState } from 'react';
import axios from 'axios';
import { Button, Card, Badge, LoadingSpinner } from './ui';
import { AI_SERVICE_URL } from '../config';

function ImageUpload() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [classificationResult, setClassificationResult] = useState<any>(null);
  const [detectionResult, setDetectionResult] = useState<any>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setClassificationResult(null);
      setDetectionResult(null);
    }
  };

  const handleClassify = async () => {
    if (!selectedImage) return;
    setLoading(true);
    setClassificationResult(null);
    setDetectionResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await axios.post(
        `${AI_SERVICE_URL}/api/vision/classify`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setClassificationResult(response.data);
    } catch (error: any) {
      console.error('Error classifying:', error);
      setClassificationResult({ error: error.response?.data?.error || 'Failed to classify' });
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = async () => {
    if (!selectedImage) return;
    setLoading(true);
    setClassificationResult(null);
    setDetectionResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await axios.post(
        `${AI_SERVICE_URL}/api/vision/detect`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setDetectionResult(response.data);
    } catch (error: any) {
      console.error('Error detecting:', error);
      setDetectionResult({ error: error.response?.data?.error || 'Failed to detect objects' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-5xl mx-auto">
        
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🧠 AI Vision Platform</h1>
          <p className="text-gray-400">Security Analysis: ResNet50 + YOLOv8n</p>
        </header>

        <Card className="mb-6 bg-slate-900 border-slate-800">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700 transition-all"
          />
        </Card>

        {/* Standard Preview (Only show if we don't have an annotated detection image yet) */}
        {previewUrl && !detectionResult?.image_with_boxes && (
          <Card className="mb-6 text-center bg-slate-900 border-slate-800">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-96 mx-auto rounded-lg shadow-xl"
            />
          </Card>
        )}

        {selectedImage && (
          <div className="flex gap-4 justify-center mb-6">
            <Button onClick={handleClassify} disabled={loading} variant="primary" className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Analyzing...' : '🏷️ Classify'}
            </Button>
            <Button onClick={handleDetect} disabled={loading} variant="secondary" className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? 'Scanning...' : '📦 Detect Objects'}
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center my-8 gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-blue-400 animate-pulse">Running Neural Networks...</span>
          </div>
        )}

        {/* CLASSIFICATION DISPLAY */}
        {classificationResult && (
          <Card className="mb-6 border-blue-500 bg-slate-900">
            <h3 className="text-2xl font-bold mb-4">🏷️ Identification</h3>
            {classificationResult.error ? (
              <p className="text-red-400">{classificationResult.error}</p>
            ) : (
              <div>
                <p className="text-3xl font-bold text-blue-400 mb-4">
                  {classificationResult.topPrediction} <span className="text-lg text-gray-500">({classificationResult.topConfidence})</span>
                </p>
                <div className="space-y-2">
                  {classificationResult.predictions?.map((pred: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-gray-300 font-medium">{pred.label}</span>
                      <Badge className="bg-blue-900 text-blue-100">{pred.confidence_percent}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* DETECTION DISPLAY */}
        {detectionResult && (
          <Card className="border-emerald-500 bg-slate-900">
            <h3 className="text-2xl font-bold mb-4">📦 Security Scan Results</h3>
            {detectionResult.error ? (
              <p className="text-red-400">{detectionResult.error}</p>
            ) : (
              <div>
                {detectionResult.image_with_boxes && (
                  <div className="mb-6 text-center">
                    <img
                      src={detectionResult.image_with_boxes}
                      alt="Detections"
                      className="max-w-full rounded-lg border-2 border-emerald-500 shadow-2xl mx-auto"
                    />
                  </div>
                )}

                <div className="bg-emerald-950/30 p-4 rounded-lg mb-4 border border-emerald-900">
                  <p className="text-xl font-bold text-emerald-400">
                    Detected {detectionResult.totalObjects || 0} unique object(s)
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detectionResult.detections?.map((det: any, idx: number) => (
                    <Card key={idx} className="bg-slate-950 border-slate-800">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-lg font-bold text-white capitalize">{det.class}</span>
                        <Badge className="bg-emerald-900 text-emerald-100">{det.confidence_percent}</Badge>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        BBOX: {det.bbox.width}x{det.bbox.height}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

export default ImageUpload;