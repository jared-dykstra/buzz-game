#ifndef DEBOUNCE_H
#define DEBOUNCE_H

#include <Arduino.h>

/**
* Invokes a callback when a value remains in a new state longer than DELAY
*/
template<typename TState>
class Debounce {
public:
  typedef TState (*Callback)(TState);

private:
  // the debounce time; increase if the output flickers
  const unsigned long DELAY = 50;

  TState state;
  const TState& initialState;
  unsigned long lastDebounceTime = 0;
  Callback callback = NULL;
  int prevCallbackResult = NULL;

public:
  Debounce(Debounce::Callback f, const TState& initialCallbackValue = 0, const TState& initialState = LOW);
  virtual ~Debounce();

  TState poll(TState value);
};

// Explicit instantiation
template class Debounce<int>;
// template class Debounce<bool>;

#endif  // DEBOUNCE_H
