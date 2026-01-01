import { useState } from 'react';
import axios from 'axios';
import { Button, Card, Badge, LoadingSpinner } from './ui';

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
        'http://localhost:5000/api/vision/classify',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setClassificationResult(response.data);
    } catch (error: any) {
      console.error('Error classifying:', error);
      setClassificationResult({ error: error.response?.data?.details || 'Failed to classify' });
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
        'http://localhost:5000/api/vision/detect',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setDetectionResult(response.data);
    } catch (error: any) {
      console.error('Error detecting:', error);
      setDetectionResult({ error: error.response?.data?.details || 'Failed to detect objects' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-5xl mx-auto">
        
        <h1 className="text-4xl font-bold text-white text-center mb-2">
          🧠 AI Vision Platform - Security Edition
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Powered by ResNet50 & YOLOv8
        </p>

        {/* Upload Section */}
        <Card className="mb-6">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
          />
        </Card>

        {/* Preview Image */}
        {previewUrl && !detectionResult?.image_with_boxes && (
          <Card className="mb-6 text-center">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-96 mx-auto rounded-lg"
            />
          </Card>
        )}

        {/* Action Buttons */}
        {selectedImage && (
          <div className="flex gap-4 justify-center mb-6">
            <Button onClick={handleClassify} disabled={loading} variant="primary" size="lg">
              {loading ? 'Processing...' : '🏷️ Classify (ResNet50)'}
            </Button>
            <Button onClick={handleDetect} disabled={loading} variant="secondary" size="lg">
              {loading ? 'Processing...' : '📦 Detect (YOLO)'}
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center my-8">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Classification Results */}
        {classificationResult && (
          <Card className="mb-6 border-blue-500">
            <h3 className="text-2xl font-bold text-white mb-4">🏷️ Classification Result</h3>
            {classificationResult.error ? (
              <p className="text-red-400">{classificationResult.error}</p>
            ) : (
              <div>
                <p className="text-3xl font-bold text-primary-blue mb-4">
                  {classificationResult.topPrediction} ({classificationResult.topConfidence})
                </p>
                <h4 className="text-lg font-semibold text-white mb-2">Alternative Matches:</h4>
                <div className="space-y-2">
                  {classificationResult.predictions?.map((pred: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-dark-bg p-3 rounded-lg">
                      <span className="text-gray-300 font-medium">{pred.label}</span>
                      <Badge variant="info">{pred.confidence_percent}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Detection Results */}
        {detectionResult && (
          <Card className="border-green-500">
            <h3 className="text-2xl font-bold text-white mb-4">📦 Object Detection Analysis</h3>
            {detectionResult.error ? (
              <p className="text-red-400">{detectionResult.error}</p>
            ) : (
              <div>
                
                {/* Annotated Image */}
                {detectionResult.image_with_boxes && (
                  <div className="mb-6 text-center">
                    <h4 className="text-lg font-semibold text-white mb-3">🎨 Annotated Vision Output:</h4>
                    <img
                      src={detectionResult.image_with_boxes}
                      alt="Detections"
                      className="max-w-full rounded-lg border-4 border-accent-green shadow-lg mx-auto"
                    />
                  </div>
                )}

                {/* Detection Summary */}
                <div className="bg-dark-bg p-4 rounded-lg mb-4">
                  <p className="text-xl font-bold text-white">
                    Found {detectionResult.totalObjects} unique object(s):
                  </p>
                </div>

                {/* Detection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detectionResult.detections?.map((det: any, idx: number) => (
                    <Card key={idx} className="bg-dark-bg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-lg font-bold text-white capitalize">{det.class}</span>
                        <Badge variant="success">{det.confidence_percent}</Badge>
                      </div>
                      <div className="text-sm text-gray-400">
                        Size: {det.bbox.width}×{det.bbox.height}px
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