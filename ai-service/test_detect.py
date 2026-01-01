import requests

# Test the detect endpoint
url = 'http://localhost:5001/detect'

# Use the test image from earlier
test_image_url = 'https://ultralytics.com/images/bus.jpg'

# Download test image
import urllib.request
urllib.request.urlretrieve(test_image_url, 'test_bus.jpg')

# Send to detect endpoint
with open('test_bus.jpg', 'rb') as f:
    files = {'image': f}
    response = requests.post(url, files=files)

print("Status:", response.status_code)
print("\nResponse keys:", response.json().keys())

# Check if image_with_boxes exists
if 'image_with_boxes' in response.json():
    print("✅ image_with_boxes field EXISTS!")
    img_data = response.json()['image_with_boxes']
    print(f"   Length: {len(img_data)} characters")
    print(f"   Starts with: {img_data[:50]}...")
else:
    print("❌ image_with_boxes field MISSING!")

print(f"\nTotal detections: {response.json().get('total_objects', 0)}")