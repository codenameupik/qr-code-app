import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator, Modal } from 'react-native';
import jsQR from 'jsqr';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs/browser';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [view, setView] = useState('menu'); // 'menu', 'camera'
  const [loading, setLoading] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [scannedResult, setScannedResult] = useState({ type: '', data: '' });
  const isCancelled = useRef(false);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    setScannedResult({ type, data });
    setResultModalVisible(true);
  };

  const handleCancel = () => {
    isCancelled.current = true;
    setLoading(false);
  };

  const handleCloseModal = () => {
    setResultModalVisible(false);
    setScanned(false);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(scannedResult.data);
    Alert.alert("Copied", "Text copied to clipboard!");
  };

  const handleOpenLink = async () => {
    try {
      const supported = await Linking.canOpenURL(scannedResult.data);
      if (supported) {
        await Linking.openURL(scannedResult.data);
      } else {
        Alert.alert("Error", "Cannot open this URL: " + scannedResult.data);
      }
    } catch (err) {
      Alert.alert("Error", "An error occurred trying to open the link.");
    }
  };

  const isUrl = (text) => {
    return text && (text.startsWith('http://') || text.startsWith('https://'));
  };

  const scanFromImage = async () => {
    console.log("scanFromImage called");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("Permission status:", status);
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    console.log("Launching image library...");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Reverting to deprecated but working option
      allowsEditing: false,
      quality: 1,
    });
    console.log("Image library result:", result);

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
              setScannedResult({ type: 'Image', data: code.data });
              setResultModalVisible(true);
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

  return (
    <View style={{ flex: 1 }}>
      {view === 'menu' && (
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
      )}

      {view === 'camera' && (
        <View style={styles.container}>
          {(!permission || !permission.granted) ? (
            <View style={styles.container}>
              <Text style={styles.message}>We need your permission to show the camera</Text>
              <Button onPress={requestPermission} title="grant permission" />
              <Button onPress={() => setView('menu')} title="Back to Menu" />
            </View>
          ) : (
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
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={resultModalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalCenteredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Scanned!</Text>
            <Text style={styles.modalText}>Type: {scannedResult.type}</Text>
            <Text style={styles.modalData}>{scannedResult.data}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.button, styles.buttonCopy]} onPress={handleCopy}>
                <Text style={styles.textStyle}>Copy</Text>
              </TouchableOpacity>

              {isUrl(scannedResult.data) && (
                <TouchableOpacity style={[styles.button, styles.buttonLink]} onPress={handleOpenLink}>
                  <Text style={styles.textStyle}>Open Link</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.button, styles.buttonClose]} onPress={handleCloseModal}>
              <Text style={styles.textStyle}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
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
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalText: {
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  modalData: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonCopy: {
    backgroundColor: '#2196F3',
  },
  buttonLink: {
    backgroundColor: '#4CAF50',
  },
  buttonClose: {
    backgroundColor: '#f44336',
    marginTop: 10,
    width: '100%',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
