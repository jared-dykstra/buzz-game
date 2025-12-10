import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Modal,
  Backdrop,
  Fade,
} from '@mui/material';
import { Videocam, VideocamOff, Usb, UsbOff } from '@mui/icons-material';
import confetti from 'canvas-confetti';
import styles from './App.module.css';
import type { SerialPort } from './types.d.ts';

type FinishedSession = {
  dateTime: string;
  timerValue: string;
  hitCount: number;
  imageData: string | null;
};

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const showButtons = searchParams.get('buttons') === '1';
  const showConsole = searchParams.get('console') === '1';
  const shouldReset = searchParams.get('reset') === '1';

  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [serialError, setSerialError] = useState<string | null>(null);
  const [serialData, setSerialData] = useState<string[]>([]);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [counter, setCounter] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<FinishedSession | null>(null);
  const [finishedSessions, setFinishedSessions] = useState<FinishedSession[]>(
    () => {
      if (shouldReset) {
        localStorage.removeItem('buzz-game-sessions');
        return [];
      }
      const stored = localStorage.getItem('buzz-game-sessions');
      if (stored) {
        try {
          return JSON.parse(stored) as FinishedSession[];
        } catch (err) {
          console.error('Error loading sessions from localStorage:', err);
          return [];
        }
      }
      return [];
    }
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (shouldReset) {
      const newSearchParams = new URLSearchParams(window.location.search);
      newSearchParams.delete('reset');
      const newSearch = newSearchParams.toString();
      const newUrl = newSearch
        ? `${window.location.pathname}?${newSearch}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [shouldReset]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem(
      'buzz-game-sessions',
      JSON.stringify(finishedSessions)
    );
  }, [finishedSessions]);

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsWebcamActive(true);
          setWebcamError(null);
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
        const error = err as DOMException;
        setWebcamError(
          error.name === 'NotAllowedError'
            ? 'Webcam access denied. Please allow camera permissions.'
            : error.name === 'NotFoundError'
              ? 'No webcam found. Please connect a camera.'
              : 'Failed to access webcam. Please check your camera settings.'
        );
        setIsWebcamActive(false);
      }
    };

    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const connectSerialPort = async () => {
    try {
      if (!navigator.serial) {
        setSerialError(
          'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.'
        );
        return;
      }

      const port = await navigator.serial!.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsSerialConnected(true);
      setSerialError(null);

      const reader = port.readable.getReader();
      readerRef.current = reader;

      const readData = async () => {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            const lines = text.split('\n').filter((line) => line.trim());

            setSerialData((prev) => {
              const newData = [...prev, ...lines];
              return newData.slice(-1000);
            });
          }
        } catch (err) {
          const error = err as DOMException;
          if (error.name !== 'NetworkError') {
            console.error('Error reading from serial port:', err);
            setSerialError('Error reading from serial port');
          }
        }
      };

      readData();
    } catch (err) {
      console.error('Error connecting to serial port:', err);
      const error = err as DOMException;
      if (error.name === 'NotFoundError') {
        setSerialError('No serial port selected.');
      } else if (error.name === 'SecurityError') {
        setSerialError('Serial port access denied. Please allow permissions.');
      } else {
        setSerialError('Failed to connect to serial port: ' + error.message);
      }
      setIsSerialConnected(false);
    }
  };

  const disconnectSerialPort = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
      setIsSerialConnected(false);
      setSerialData([]);
    } catch (err) {
      console.error('Error disconnecting serial port:', err);
    }
  };

  useEffect(() => {
    return () => {
      disconnectSerialPort();
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const handleStartReset = () => {
    if (isTimerRunning) {
      setIsTimerRunning(false);
      setTimerSeconds(0);
      setCounter(0);
    } else {
      setIsTimerRunning(true);
    }
  };

  const handleHit = () => {
    setCounter((prev) => prev + 1);
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 450);
  };

  const captureWebcamImage = (): string | null => {
    if (!videoRef.current || !isWebcamActive) {
      return null;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleFinished = () => {
    setIsTimerRunning(false);

    const now = new Date();
    const dateTime = now.toLocaleString();
    const imageData = captureWebcamImage();
    const session: FinishedSession = {
      dateTime,
      timerValue: formatTime(timerSeconds),
      hitCount: counter,
      imageData,
    };
    setFinishedSessions((prev) => [session, ...prev]);

    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatCounter = (count: number): string => {
    return String(count).padStart(4, '0');
  };

  return (
    <Box className={`${styles.container} ${isPulsing ? styles.pulse : ''}`}>
      <Box className={styles.topRow}>
        <Paper className={styles.timerCell} elevation={3}>
          <Box className={styles.digitalDisplay}>
            <Typography variant="h2" className={styles.digitalText}>
              {formatTime(timerSeconds)}
            </Typography>
          </Box>
        </Paper>
        <Paper className={styles.webcamCell} elevation={3}>
          {(!isWebcamActive || webcamError) && (
            <Box className={styles.webcamHeader}>
              <Box className={styles.headerContent}>
                {isWebcamActive ? (
                  <Videocam color="success" />
                ) : (
                  <VideocamOff color="error" />
                )}
                <Typography variant="h6" component="h2">
                  Webcam Feed
                </Typography>
              </Box>
            </Box>
          )}
          {webcamError ? (
            <Box className={styles.errorContainer}>
              <Alert severity="error">{webcamError}</Alert>
            </Box>
          ) : (
            <Box className={styles.videoContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.video}
              />
            </Box>
          )}
        </Paper>
        <Paper
          className={`${styles.counterCell} ${isPulsing ? styles.counterPulse : ''}`}
          elevation={3}
        >
          <Box className={styles.digitalDisplay}>
            <Typography
              variant="h2"
              className={`${styles.digitalText} ${isPulsing ? styles.counterTextPulse : ''}`}
            >
              {formatCounter(counter)}
            </Typography>
          </Box>
        </Paper>
      </Box>

      <Box className={styles.tableSection}>
        <Paper className={styles.tablePaper} elevation={3}>
          <TableContainer className={styles.tableContainer}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Date & Time</TableCell>
                  <TableCell>Timer</TableCell>
                  <TableCell>Hits</TableCell>
                  <TableCell>Photo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {finishedSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No finished sessions yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  finishedSessions.map((session, index) => (
                    <TableRow
                      key={index}
                      onClick={() =>
                        session.imageData && setSelectedSession(session)
                      }
                      style={{
                        cursor: session.imageData ? 'pointer' : 'default',
                      }}
                    >
                      <TableCell>{session.dateTime}</TableCell>
                      <TableCell>{session.timerValue}</TableCell>
                      <TableCell>{session.hitCount}</TableCell>
                      <TableCell>
                        {session.imageData ? (
                          <img
                            src={session.imageData}
                            alt="Session photo"
                            className={styles.thumbnail}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No photo
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {showConsole && (
        <Box className={styles.serialSection}>
          <Paper className={styles.serialPaper} elevation={3}>
            <Box className={styles.serialHeader}>
              <Box className={styles.headerContent}>
                {isSerialConnected ? (
                  <Usb color="success" />
                ) : (
                  <UsbOff color="action" />
                )}
                <Typography variant="h6" component="h2">
                  Serial Port Output
                </Typography>
              </Box>
              {!isSerialConnected ? (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Usb />}
                  onClick={connectSerialPort}
                >
                  Connect Serial Port
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<UsbOff />}
                  onClick={disconnectSerialPort}
                >
                  Disconnect
                </Button>
              )}
            </Box>
            {serialError && (
              <Box className={styles.errorContainer}>
                <Alert severity="error" onClose={() => setSerialError(null)}>
                  {serialError}
                </Alert>
              </Box>
            )}
            <Box className={styles.serialOutput}>
              {serialData.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  className={styles.emptyState}
                >
                  {isSerialConnected
                    ? 'Waiting for data from serial port...'
                    : 'Click "Connect Serial Port" to begin receiving data'}
                </Typography>
              ) : (
                <Box className={styles.dataContainer}>
                  {serialData.map((line, index) => (
                    <Typography
                      key={index}
                      variant="body2"
                      component="div"
                      className={styles.dataLine}
                    >
                      {line}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      )}
      {showButtons && (
        <Box className={styles.buttonRow}>
          <Button
            variant="contained"
            color={isTimerRunning ? 'error' : 'primary'}
            onClick={handleStartReset}
            className={styles.controlButton}
          >
            {isTimerRunning ? 'Reset' : 'Start'}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleHit}
            disabled={!isTimerRunning}
            className={styles.controlButton}
          >
            Hit
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleFinished}
            disabled={!isTimerRunning}
            className={styles.controlButton}
          >
            Finished
          </Button>
        </Box>
      )}
      <Modal
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
        className={styles.imageModal}
      >
        <Fade in={!!selectedSession}>
          <Box
            className={styles.imageModalContent}
            onClick={() => setSelectedSession(null)}
          >
            {selectedSession && selectedSession.imageData && (
              <Box
                className={styles.imageContainer}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedSession.imageData}
                  alt="Full size session photo"
                  className={styles.fullSizeImage}
                />
                <Box className={styles.imageOverlay}>
                  <Typography variant="h4" className={styles.overlayText}>
                    {selectedSession.timerValue}
                  </Typography>
                  <Typography variant="h5" className={styles.overlayText}>
                    {selectedSession.hitCount} hits
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Fade>
      </Modal>
    </Box>
  );
}

export default App;
