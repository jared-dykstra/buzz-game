# Buzz Game

A monorepo containing the Buzz Game project.

## Structure

- `packages/web` - Web application (Serial Port & Webcam Viewer)

## Requirements

- Node.js 24+ and npm
- Chrome, Edge, or Opera browser (for Web Serial API support)
- Webcam device
- Serial port device (optional)

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This will start the web application, available at `http://localhost:5173`

## Packages

### @buzz-game/web

A React application that displays webcam feed and serial port data in real-time.

#### Features

- **Webcam Feed**: Displays live video from your webcam in the top half of the screen
- **Serial Port Input**: Connects to a COM port and displays incoming data in a scrolling frame on the bottom half
- **Permission Handling**: Gracefully handles camera and serial port permission requests
- **Material UI**: Modern, responsive UI built with Material UI and CSS modules

#### Usage

1. **Webcam**: The app will automatically request camera permissions when opened. Grant permission to see the webcam feed.

2. **Serial Port**: 
   - Click the "Connect Serial Port" button
   - Select your COM port from the browser's device picker
   - Data from the serial port will appear in the scrolling output area
   - Click "Disconnect" to close the connection

#### Browser Compatibility

- **Web Serial API**: Only supported in Chrome, Edge, and Opera
- **Webcam**: Supported in all modern browsers

#### Query String Parameters

The application supports optional query string parameters to control visibility of certain UI elements:

- `buttons=1` - Shows the control buttons row (Start/Reset, Hit, Finished). By default, buttons are hidden.
- `console=1` - Shows the serial port console section. By default, the console is hidden.

Examples:
- `http://localhost:5173?buttons=1` - Shows only the buttons
- `http://localhost:5173?console=1` - Shows only the console
- `http://localhost:5173?buttons=1&console=1` - Shows both buttons and console

## Build

```bash
npm run build
```

## License

MIT

