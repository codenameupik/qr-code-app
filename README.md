# Snappy QR

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Expo](https://img.shields.io/badge/expo-54.0.25-black)
![React Native](https://img.shields.io/badge/react--native-0.81.5-cyan)

**Fast QR Scanner & Generator**

Snappy QR is a simple, efficient, and privacy-focused QR code scanner and generator built with Expo and React Native. It allows users to scan QR codes instantly using the camera or from images in the gallery, and generate their own QR codes with ease.

## Screenshots

<!-- Add screenshots here -->
<!--
<div style="display: flex; flex-direction: row; gap: 10px;">
  <img src="path/to/screenshot1.png" alt="Home Screen" width="200" />
  <img src="path/to/screenshot2.png" alt="Scanner" width="200" />
  <img src="path/to/screenshot3.png" alt="Generator" width="200" />
</div>
-->

## Features

- **⚡ Fast Camera Scanning**: Real-time QR code scanning using the device's back camera.
- **🖼️ Image Scanning**: Scan QR codes directly from images stored in your gallery.
- **📝 QR Generator**: Create QR codes for text or URLs instantly.
- **📜 Scan History**: Keep track of your scanned QR codes and clear history when needed.
- **🔗 Interactive Results**: Copy scanned text to clipboard or open URLs directly.
- **🌗 Dark Mode**: Seamlessly switch between light and dark themes.
- **🔒 Privacy Focused**: No data leaves your device; all processing is done locally.

## Getting Started

### Prerequisites

- Node.js installed.
- Expo Go app installed on your Android or iOS device.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/snappy-qr.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd snappy-qr
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```

### Running the App

1.  Start the development server:
    ```bash
    npx expo start
    ```
2.  Scan the QR code displayed in the terminal using the Expo Go app.

## Technologies Used

- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
- [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/)
- [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [jsQR](https://github.com/cozmo/jsQR) (for image decoding)
- [react-native-qrcode-svg](https://github.com/awesomejerry/react-native-qrcode-svg)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
