import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import jsQR from 'jsqr';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs/browser';
import * as ImageManipulator from 'expo-image-manipulator';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [view, setView] = useState('menu'); // 'menu', 'camera'
  const [loading, setLoading] = useState(false);
  const isCancelled = useRef(false);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    Alert.alert("Scanned!", `Bar code with type ${type} and data ${data} has been scanned!`, [
      { text: "OK", onPress: () => setScanned(false) }
    ]);
  };

  const handleCancel = () => {
    isCancelled.current = true;
    setLoading(false);
  };

  const scanFromImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLoading(true);
      isCancelled.current = false;
      const asset = result.assets[0];

      // Timeout Logic
      const timeoutId = setTimeout(() => {
        if (!isCancelled.current) {
          isCancelled.current = true;
          setLoading(false);
          Alert.alert("Timeout", "Image processing took too long. Please try a smaller image or one with a clearer QR code.");
        }
      }, 10000); // 10 seconds

      // Use setTimeout to allow the UI to update (show loading spinner) before heavy processing
      setTimeout(async () => {
        if (isCancelled.current) return;
        try {
          // Resize image to optimize performance
          const manipulatedResult = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 500 } }], // Resize to 500px width, maintain aspect ratio
            { base64: true, format: ImageManipulator.SaveFormat.JPEG } // Force JPEG for consistent decoding
          );

          if (isCancelled.current) return;

          const base64 = manipulatedResult.base64;

          if (!base64) {
            Alert.alert("Error", "Could not get image data.");
            return;
          }

          const buffer = Buffer.from(base64, 'base64');
          if (isCancelled.current) return;

          let width, height, data;

          // Since we forced JPEG in manipulation, we can just use jpeg-js
          const rawImageData = jpeg.decode(buffer, { useTArray: true });
          width = rawImageData.width;
          height = rawImageData.height;
          data = new Uint8ClampedArray(rawImageData.data);

          if (isCancelled.current) return;

          if (data) {
            const code = jsQR(data, width, height);
            if (isCancelled.current) return;

            if (code) {
              Alert.alert("Scanned from Image!", `Data: ${code.data}`);
            } else {
              Alert.alert("No QR Code Found", "Could not detect a QR code in this image.");
            }
          } else {
            Alert.alert("Error", "Could not decode image data.");
          }

        } catch (error) {
          if (!isCancelled.current) {
            console.error(error);
            Alert.alert("Error", "Failed to scan image. " + error.message);
          }
        } finally {
          clearTimeout(timeoutId);
          if (!isCancelled.current) {
            setLoading(false);
          }
        }
      }, 100);
    }
  };

  if (view === 'menu') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>QR Scanner App</Text>
        <TouchableOpacity style={styles.menuButton} onPress={() => setView('camera')}>
          <Text style={styles.menuButtonText}>Scan with Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={scanFromImage}>
          <Text style={styles.menuButtonText}>Scan from Gallery</Text>
        </TouchableOpacity>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Processing Image...</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (view === 'camera') {
    if (!permission) {
      return <View />;
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.message}>We need your permission to show the camera</Text>
          <Button onPress={requestPermission} title="grant permission" />
          <Button onPress={() => setView('menu')} title="Back to Menu" />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setView('menu')}>
              <Text style={styles.text}>Back to Menu</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  menuButton: {
    backgroundColor: '#2196F3',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  menuButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  backButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#ff4444',
    padding: 10,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
