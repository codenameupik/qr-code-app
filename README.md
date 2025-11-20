# Snappy QR

A simple and efficient QR code scanner application built with Expo React Native. This app allows users to scan QR codes directly using the camera or by selecting an image from the device's gallery.

## Features

- **Camera Scanning**: Real-time QR code scanning using the device's back camera.
- **Image Scanning**: Scan QR codes from images stored in your gallery.
- **Scan History**: View a history of your scanned QR codes and clear them when needed.
- **Interactive Results**: Copy scanned text to clipboard or open URLs directly from the app.
- **Pure JavaScript Decoding**: Uses `jsQR` for reliable image decoding without requiring native modules incompatible with Expo Go.
- **Optimized Performance**: Automatic image resizing and timeout handling for fast and responsive scanning.
- **User-Friendly Interface**: Simple menu navigation, clear feedback with loading indicators, and a clean result modal.

## Getting Started

### Prerequisites

- Node.js installed.
- Expo Go app installed on your Android or iOS device.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    ```
2.  Navigate to the project directory:
    ```bash
    cd qr-code-app
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
