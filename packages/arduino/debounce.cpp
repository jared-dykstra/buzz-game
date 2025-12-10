#include "Debounce.h"

template<typename TState>
Debounce<TState>::Debounce(Debounce::Callback f, const TState& initialCallbackValue, const TState& initialState)
  : callback(f),
    prevCallbackResult(initialCallbackValue),
    initialState(initialState),
    state(initialState) {
  this->lastDebounceTime = millis();
}

template<typename TState>
Debounce<TState>::~Debounce(){};

template<typename TState>
TState Debounce<TState>::poll(TState value) {
  unsigned long currentTime = millis();

  if (value != this->state && currentTime - lastDebounceTime > this->DELAY) {
    // Change detected
    this->lastDebounceTime = currentTime;
    this->state = value;
    // Serial.print("value ");
    // Serial.println(this->initialState);

    if (this->state != this->initialState) {
      // pressed
      // Serial.println("pressed");
      this->prevCallbackResult = this->callback(this->state);
    } else {
      // released
      // Serial.println("released");
      this->prevCallbackResult = this->callback(this->state);
    }
  }

  return this->prevCallbackResult;
}
