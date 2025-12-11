/*
  LiquidCrystal Library - Hello World

 Demonstrates the use a 16x2 LCD display.  The LiquidCrystal
 library works with all LCD displays that are compatible with the
 Hitachi HD44780 driver. There are many of them out there, and you
 can usually tell them by the 16-pin interface.

 This sketch prints "Hello World!" to the LCD
 and shows the time.

  The circuit:
 * LCD RS pin to digital pin 12
 * LCD Enable pin to digital pin 11
 * LCD D4 pin to digital pin 5
 * LCD D5 pin to digital pin 4
 * LCD D6 pin to digital pin 3
 * LCD D7 pin to digital pin 2
 * LCD R/W pin to ground
 * LCD VSS pin to ground
 * LCD VCC pin to 5V
 * 10K resistor:
 * ends to +5V and ground
 * wiper to LCD VO pin (pin 3)

 Library originally added 18 Apr 2008
 by David A. Mellis
 library modified 5 Jul 2009
 by Limor Fried (http://www.ladyada.net)
 example added 9 Jul 2009
 by Tom Igoe
 modified 22 Nov 2010
 by Tom Igoe
 modified 7 Nov 2016
 by Arturo Guadalupi

 This example code is in the public domain.

 http://www.arduino.cc/en/Tutorial/LiquidCrystalHelloWorld

*/

// include the library code:
#include <LiquidCrystal.h>
#include <Servo.h>

// NOTE: Alternate debounce implementation, triggered on leading edge
// (too prone to noise)
// #include "Debounce.h"

// initialize the library by associating any needed LCD interface pin
// with the arduino pin number it is connected to
const int rs = 12, en = 11, d4 = 5, d5 = 4, d6 = 3, d7 = 2;
LiquidCrystal lcd(rs, en, d4, d5, d6, d7);

const int buzzPin = 9;
const int servoPin = 6;

const int wandPin = A0;
const int resetPin = A1;
const int finishPin = A2;

const int ledPin = A4;
const int finishedLedPin = A5;

const int NOTE_C6 = 1046;
const unsigned long autoIncrementMs = 333;

// Application State
unsigned long startTime = 0;
unsigned long wandCount = 0;
unsigned long prevWandCount = wandCount;
bool isFinished = false;

Servo servo;

/**
* Invokes a callback when a value remains in a new state longer than DELAY
*/
class Debounce {
  public:
    typedef int State;
    typedef int (*Callback)(int);

    Debounce(Debounce::Callback f, int initialCallbackValue = 0, State initialState = LOW) 
      : callback(f), 
        prevCallbackResult(initialCallbackValue), 
        lastState(initialState), 
        state(initialState) 
    {
    }

    State check(State value) {
      // If the switch changed, due to noise or pressing:
      if (value != this->lastState) {
        // reset the debouncing timer
        this->lastDebounceTime = millis();
      }

      if (((millis() - this->lastDebounceTime) > this->DELAY) 
          && (value != this->state)) {
        this->state = value;
        this->prevCallbackResult = this->callback(state);
      }

      this->lastState = value;
      return this->prevCallbackResult;
    }

  private: 
    // the debounce time; increase if the output flickers
    const unsigned long DELAY = 6;   

    State state;
    State lastState;
    unsigned long lastDebounceTime = 0;
    Callback callback = NULL;
    int prevCallbackResult = NULL;
};


void setupOutputs(const char* message = "Steady Hands?") {
  lcd.clear();
  lcd.begin(16, 2);
  lcd.print(message);

  pinMode(buzzPin, OUTPUT);
  servo.attach(servoPin);
};

void setup() {
  Serial.begin(9600);
  Serial.println("Hello");

  setupSwitches();
  setupOutputs();

  reset();
};

void loop() {
  if (!isFinished) {
    render(wandCount, millis() - startTime);
    if (wandCount > prevWandCount) {
      prevWandCount = wandCount;
      tone(buzzPin, NOTE_C6, autoIncrementMs / 2);
    }
  }
  checkButton();
};


void reset() {
  prevWandCount = 0;
  wandCount = 0;
  startTime = millis();
  isFinished = false;
};

unsigned long prevHitCount;
unsigned long prevMs;
void render(unsigned long hitCount, unsigned long ms) {
  if (prevHitCount == hitCount && prevMs == ms) {
    return;
  }

  prevHitCount = hitCount;
  prevMs = ms;

  // set the cursor to column 0, line 1
  // (note: line 1 is the second row, since counting begins with 0):
  lcd.setCursor(0, 1);
  const unsigned long seconds = (ms + 500) / 1000;
  const unsigned long minutes = seconds / 60;
  if (minutes < 10) {
    lcd.print('0');
  }
  lcd.print(minutes);
  lcd.print(":");
  if (seconds % 60 < 10) {
    lcd.print('0');
  }
  lcd.print(seconds % 60);
  lcd.print(" Hits: ");
  lcd.print(hitCount);
  lcd.print("    ");

  const int degrees = hitCount * 6;
  servo.write(180 - (degrees < 180? degrees : 180));
};


const int initialResetState = false;
const int initialLedState = HIGH;
unsigned long throttleStartTime = 0;

void setupSwitches() {
  pinMode(wandPin, INPUT);
  pinMode(resetPin, INPUT);
  pinMode(ledPin, OUTPUT);
  pinMode(finishedLedPin, OUTPUT);

  // set initial LED state
  digitalWrite(ledPin, initialLedState);
  digitalWrite(finishedLedPin, initialLedState);

  startTime = millis();
}


Debounce wandBtn(onWand, initialLedState);
const int onWand(int newValue) {
  // Serial.print("onWand");
  if (newValue == HIGH && !isFinished) {
    wandCount++;
    Serial.print("CMD: Hit, ");
    Serial.println(wandCount);
    throttleStartTime = millis();
  }
  return !newValue;
}

Debounce resetBtn(onReset, initialResetState);
const bool onReset(int newValue) {
  Serial.println("CMD: Reset");
  return newValue != initialResetState;
}

Debounce finishedBtn(onFinished, false);
const void onFinished(int newValue) {
  // Serial.println("onFinished");
  if (newValue) {
    isFinished = true;
    Serial.println("CMD: Finished");
    Serial.print("Finished, hits: ");
    Serial.print(wandCount);
    Serial.print(" time: ");
    Serial.println(millis() - startTime);
  }
  return isFinished;
}

const checkButton() {
  const unsigned long ms = millis();
  const int ledState = wandBtn.check(digitalRead(wandPin));
  const bool resetState = resetBtn.check(digitalRead(resetPin));
  finishedBtn.check(digitalRead(finishPin));

  // If reset is currently active...
  if (resetState) {
    reset();
  }

  // If held down, auto-increment the wand counter
  if (!isFinished && ledState != initialLedState && (ms - throttleStartTime > autoIncrementMs)) {
    wandCount++;
    Serial.print("CMD: Hit, ");
    Serial.println(wandCount);
    throttleStartTime = ms;
  }

  // Keep the LED on for a minimum duration
  const bool holdState = throttleStartTime > 0 && (ms <= throttleStartTime + autoIncrementMs);

  // Update the LEDs
  digitalWrite(ledPin, isFinished ? initialLedState : holdState ? !initialLedState
                                                                : ledState);
  digitalWrite(finishedLedPin, isFinished ? !initialLedState : initialLedState);
};
