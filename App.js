import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useState, useRef, useEffect } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator, Modal, ScrollView, FlatList, TextInput } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import jsQR from 'jsqr';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs/browser';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';

const THEMES = {
  light: {
    background: '#FAFAFA',
    text: '#1A1A1A',
    textSecondary: '#6B7280',
    textLight: '#FFFFFF',
    primary: '#6366F1',
    secondary: '#8B5CF6',
    success: '#10B981',
    danger: '#EF4444',
    card: '#FFFFFF',
    border: '#E5E7EB',
    inputBg: '#FFFFFF',
    modalBg: '#FFFFFF',
    overlay: 'rgba(26,26,26,0.85)',
  },
  dark: {
    background: '#111827',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textLight: '#FFFFFF',
    primary: '#818CF8',
    secondary: '#A78BFA',
    success: '#34D399',
    danger: '#F87171',
    card: '#1F2937',
    border: '#374151',
    inputBg: '#374151',
    modalBg: '#1F2937',
    overlay: 'rgba(0,0,0,0.9)',
  },
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [view, setView] = useState('menu'); // 'menu', 'camera', 'history', 'create'
  const [loading, setLoading] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [scannedResult, setScannedResult] = useState({ type: '', data: '' });
  const [history, setHistory] = useState([]);
  const [qrText, setQrText] = useState('');
  const [generatedQR, setGeneratedQR] = useState('');
  const [theme, setTheme] = useState('light');
  const qrRef = useRef(null);
  const isCancelled = useRef(false);

  const colors = THEMES[theme];
  const styles = getStyles(colors);

  useEffect(() => {
    loadHistory();
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const storedTheme = await AsyncStorage.getItem('app_theme');
      if (storedTheme) {
        setTheme(storedTheme);
      }
    } catch (error) {
      console.error("Failed to load theme", error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('app_theme', newTheme);
    } catch (error) {
      console.error("Failed to save theme", error);
    }
  };

  const loadHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('qr_history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Failed to load history", error);
    }
  };

  const addToHistory = async (type, data) => {
    const newItem = {
      id: Date.now().toString(),
      type,
      data,
      date: new Date().toLocaleString(),
    };
    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    try {
      await AsyncStorage.setItem('qr_history', JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save history", error);
    }
  };

  const clearHistory = async () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all scan history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setHistory([]);
            await AsyncStorage.removeItem('qr_history');
          }
        }
      ]
    );
  };

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    setScannedResult({ type, data });
    setResultModalVisible(true);
    addToHistory(type, data);
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

  const shareQRCode = async () => {
    try {
      if (!qrRef.current) {
        Alert.alert("Error", "QR Code not found");
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Convert QR code to data URL
      qrRef.current.toDataURL(async (dataURL) => {
        try {
          const filename = FileSystem.cacheDirectory + `qrcode_${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(filename, dataURL, {
            encoding: 'base64',
          });
          
          await Sharing.shareAsync(filename, {
            mimeType: 'image/png',
            dialogTitle: 'Share QR Code',
            UTI: 'public.png'
          });
        } catch (error) {
          console.error(error);
          Alert.alert('Error', 'Failed to share QR code: ' + error.message);
        }
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to share QR code: ' + error.message);
    }
  };


  const scanFromImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Reverting to deprecated but working option
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
              setScannedResult({ type: 'Image', data: code.data });
              setResultModalVisible(true);
              addToHistory('Image', code.data);
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

  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => {
        setScannedResult({ type: item.type, data: item.data });
        setResultModalVisible(true);
      }}
    >
      <View>
        <Text style={styles.historyData} numberOfLines={1}>{item.data}</Text>
        <Text style={styles.historyDate}>{item.date} • {item.type}</Text>
      </View>
      <Text style={styles.historyArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {view === 'menu' && (
        <View style={styles.container}>
          <Text style={styles.title}>QR Scanner App</Text>
          <TouchableOpacity style={styles.menuButton} onPress={() => setView('camera')}>
            <Text style={styles.menuButtonText}>Scan with Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={scanFromImage}>
            <Text style={styles.menuButtonText}>Scan from Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, styles.historyButton]} onPress={() => setView('history')}>
            <Text style={styles.menuButtonText}>Scan History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, styles.createButton]} onPress={() => setView('create')}>
            <Text style={styles.menuButtonText}>Create QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, styles.settingsButton]} onPress={() => setView('settings')}>
            <Text style={styles.menuButtonText}>Settings</Text>
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

      {view === 'history' && (
        <View style={styles.container}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Scan History</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>No scan history yet.</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.id}
              style={styles.historyList}
              contentContainerStyle={styles.historyListContent}
            />
          )}

          <TouchableOpacity style={styles.backButtonFixed} onPress={() => setView('menu')}>
            <Text style={styles.menuButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {view === 'create' && (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create QR Code</Text>
          </View>
          
          <View style={styles.content}>
            <Text style={styles.inputLabel}>Enter Text or URL</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Type something..."
              placeholderTextColor={colors.textSecondary}
              value={qrText}
              onChangeText={setQrText}
              multiline
              numberOfLines={4}
            />
            
            <TouchableOpacity 
              style={[styles.generateButton, !qrText && styles.generateButtonDisabled]} 
              onPress={() => setGeneratedQR(qrText)}
              disabled={!qrText}
            >
              <Text style={styles.menuButtonText}>Generate QR Code</Text>
            </TouchableOpacity>

            {generatedQR && (
              <View style={styles.qrContainer}>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={generatedQR}
                    size={200}
                    backgroundColor="white"
                    color="black"
                    getRef={(ref) => (qrRef.current = ref)}
                  />
                </View>
                <Text style={styles.qrText} numberOfLines={2}>{generatedQR}</Text>
                
                <TouchableOpacity style={styles.shareQRButton} onPress={shareQRCode}>
                  <Text style={styles.qrActionButtonText}>Share QR Code</Text>
                </TouchableOpacity>
                <Text style={styles.shareHint}>Tap to share or save to your device</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.backButtonFixed} onPress={() => {
            setView('menu');
            setQrText('');
            setGeneratedQR('');
          }}>
            <Text style={styles.menuButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {view === 'settings' && (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          
          <View style={styles.content}>
            <TouchableOpacity style={styles.settingItem} onPress={toggleTheme}>
              <View>
                <Text style={styles.settingLabel}>App Theme</Text>
                <Text style={styles.settingValue}>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</Text>
              </View>
              <View style={[styles.themeToggle, theme === 'dark' && styles.themeToggleActive]}>
                <View style={[styles.themeToggleKnob, theme === 'dark' && styles.themeToggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backButtonFixed} onPress={() => setView('menu')}>
            <Text style={styles.menuButtonText}>Back to Menu</Text>
          </TouchableOpacity>
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

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 48,
    color: colors.text,
    letterSpacing: -0.5,
  },
  menuButton: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 0,
    marginVertical: 8,
    width: '85%',
    alignItems: 'center',
    borderWidth: 0,
  },
  historyButton: {
    backgroundColor: colors.secondary,
  },
  createButton: {
    backgroundColor: colors.success,
  },
  settingsButton: {
    backgroundColor: '#6B7280',
  },
  menuButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: colors.textSecondary,
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
    backgroundColor: colors.text,
    padding: 16,
    borderRadius: 0,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textLight,
    marginTop: 16,
    fontSize: 16,
    marginBottom: 24,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: colors.danger,
    padding: 12,
    borderRadius: 0,
    paddingHorizontal: 32,
  },
  cancelButtonText: {
    color: colors.textLight,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  modalView: {
    margin: 20,
    backgroundColor: colors.modalBg,
    borderRadius: 0,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    borderWidth: 0,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    color: colors.text,
  },
  modalText: {
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  modalData: {
    marginBottom: 24,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  button: {
    borderRadius: 0,
    padding: 12,
    paddingHorizontal: 24,
    minWidth: 90,
    alignItems: 'center',
    borderWidth: 0,
  },
  buttonCopy: {
    backgroundColor: colors.primary,
  },
  buttonLink: {
    backgroundColor: colors.success,
  },
  buttonClose: {
    backgroundColor: colors.text,
    marginTop: 8,
    width: '100%',
  },
  textStyle: {
    color: colors.textLight,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  historyHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: colors.background,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  historyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  clearButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  historyList: {
    width: '100%',
    flex: 1,
  },
  historyListContent: {
    padding: 16,
  },
  historyItem: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 0,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  historyData: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    maxWidth: 250,
    color: colors.text,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  historyArrow: {
    fontSize: 24,
    color: colors.border,
  },
  emptyHistory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  backButtonFixed: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 0,
    margin: 20,
    marginBottom: 50,
    width: '90%',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    padding: 24,
    paddingTop: 60,
    backgroundColor: colors.background,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  textInput: {
    width: '100%',
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 0,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 0,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  generateButtonDisabled: {
    backgroundColor: colors.border,
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 0,
    marginBottom: 16,
  },
  qrText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 250,
    marginBottom: 20,
  },
  shareQRButton: {
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 0,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    marginBottom: 8,
  },
  shareHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  qrActionButtonText: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  settingItem: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  themeToggle: {
    width: 50,
    height: 28,
    backgroundColor: colors.border,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  themeToggleActive: {
    backgroundColor: colors.primary,
  },
  themeToggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  themeToggleKnobActive: {
    alignSelf: 'flex-end',
  },
});
