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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Usb,
  UsbOff,
  ExpandMore,
} from '@mui/icons-material';
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
  const [showConsole, setShowConsole] = useState(false);
  const shouldReset = searchParams.get('reset') === '1';

  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [serialError, setSerialError] = useState<string | null>(null);
  const [serialData, setSerialData] = useState<string[]>([]);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const isTimerRunning = useRef(true);
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
  const serialBufferRef = useRef<string>('');
  const timerSecondsRef = useRef(0);
  const counterRef = useRef(0);
  const serialOutputRef = useRef<HTMLDivElement>(null);

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
    timerSecondsRef.current = timerSeconds;
  }, [timerSeconds]);

  useEffect(() => {
    counterRef.current = counter;
  }, [counter]);

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

  const connectSerialPort = async (existingPort?: SerialPort) => {
    try {
      if (!navigator.serial) {
        setSerialError(
          'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.'
        );
        return;
      }

      const port = existingPort ?? (await navigator.serial!.requestPort());
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
            const fullText = serialBufferRef.current + text;
            const lines = fullText.split('\n');

            serialBufferRef.current = lines.pop() || '';

            const completeLines = lines.filter((line) => line.trim());

            completeLines.forEach((line) => {
              if (line.startsWith('CMD: ')) {
                const command = line.substring(5).trim();
                if (command.startsWith('Reset')) {
                  handleStartReset();
                } else if (command.startsWith('Hit')) {
                  handleHit();
                } else if (command.startsWith('Finished')) {
                  handleFinished();
                }
              } else if (line.startsWith('RENDER: ')) {
                const [stateKey, stateValue] = line.substring(8).trim().split('=') ?? ['', undefined];
                const value = stateValue != null ? Number.parseInt(stateValue) : undefined;
                if (value != null) {
                  if (stateKey.startsWith('hitCount')) {
                    setCounter(value);
                  } else if (stateKey.startsWith('s')) {
                    setTimerSeconds(value)
                  }

                }
              }
            });

            setSerialData((prev) => {
              const newData = [...prev, ...completeLines];
              return newData.slice(-100);
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
      serialBufferRef.current = '';
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
    const tryReconnect = async () => {
      if (!navigator.serial?.getPorts) return;
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
          await connectSerialPort(ports[0]);
        }
      } catch (err) {
        console.error('Error reconnecting to serial port:', err);
      }
    };

    void tryReconnect();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning.current) {
      // interval = setInterval(() => {
      //   setTimerSeconds((prev) => prev + 1);
      // }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (serialOutputRef.current) {
      serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight;
    }
  }, [serialData]);

  const handleStartReset = () => {
    isTimerRunning.current = true;
  };

  const handleHit = () => {
    // setCounter((prev) => prev + 1);
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 450);
  };

  const captureWebcamImage = (): string | null => {
    if (!videoRef.current) {

      return null;
    }

    const video = videoRef.current;
    const hasVideoData =
      video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

    if (!hasVideoData) {
      return null;
    }

    if (!isWebcamActive) {
      setIsWebcamActive(true);
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleFinished = () => {

    if (!isTimerRunning.current) {
      return;
    }

    isTimerRunning.current = false;

    const now = new Date();
    const dateTime = now.toLocaleString();
    const timerValue = formatTime(timerSecondsRef.current);
    const hitCount = counterRef.current;

    const saveSession = (imageData: string | null) => {
      const session: FinishedSession = {
        dateTime,
        timerValue,
        hitCount,
        imageData,
      };
      setFinishedSessions((prev) => [session, ...prev]);
    };

    let imageData = captureWebcamImage();
    if (!imageData) {
      setTimeout(() => {
        imageData = captureWebcamImage();
        saveSession(imageData);
      }, 100);
    } else {
      saveSession(imageData);
    }

    const duration = 5_000;
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
        shapes: ['square', 'square', 'star', 'circle'],
        scalar: 4,
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
    return String(count).padStart(3, '0');
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
                onLoadedMetadata={() => setIsWebcamActive(true)}
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


      <Box className={styles.serialSection}>
        <Paper elevation={3} className={styles.serialPaper}>
          <Accordion expanded={showConsole} onChange={(_, expanded) => setShowConsole(expanded)} className={styles.serialAccordion}>
            <AccordionSummary expandIcon={
              <IconButton size="small" className={styles.expandIconButton}>
                <ExpandMore />
              </IconButton>
            }>
              <Box className={styles.headerContent}>
                {!isSerialConnected ? (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Usb />}
                    onClick={(e) => {
                      e.stopPropagation();
                      connectSerialPort();
                    }}
                    className={styles.responsiveButton}
                  >
                    <Typography>
                      Connect Serial Port
                    </Typography>
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<UsbOff />}
                    onClick={(e) => {
                      e.stopPropagation();
                      disconnectSerialPort();
                    }}
                    className={styles.responsiveButton}
                  >
                    <Typography>
                      Disconnect
                    </Typography>
                  </Button>
                )}
                {serialError && (
                  <Box className={styles.errorContainer} onClick={(e) => e.stopPropagation()}>
                    <Alert severity="error" onClose={() => setSerialError(null)}>
                      {serialError}
                    </Alert>
                  </Box>
                )}
                {showButtons && (
                  <Box className={styles.buttonRow}>
                    <Button
                      variant="contained"
                      color={isTimerRunning.current ? 'error' : 'primary'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartReset();
                      }}
                      className={`${styles.controlButton} ${styles.responsiveButton}`}
                    >
                      {isTimerRunning.current ? 'Reset' : 'Start'}
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHit();
                      }}
                      disabled={!isTimerRunning.current}
                      className={`${styles.controlButton} ${styles.responsiveButton}`}
                    >
                      Hit
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFinished();
                      }}
                      disabled={!isTimerRunning.current}
                      className={`${styles.controlButton} ${styles.responsiveButton}`}
                    >
                      Finished
                    </Button>
                  </Box>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails className={styles.serialAccordionDetails}>
              <Paper className={styles.serialPaper} elevation={0}>
                <Box ref={serialOutputRef} className={styles.serialOutput}>
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
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Box>



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
                  <Typography variant="h4" className={styles.digitalText}>
                    {selectedSession.timerValue}
                  </Typography>
                  <Typography variant="h5" className={styles.overlayText}>
                    <span className={styles.digitalText}>{selectedSession.hitCount}</span> hits
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
