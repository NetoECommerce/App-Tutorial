import React, { useEffect, useState } from "react";

const styles = {
  position: "fixed",
  bottom: 100,
  right: 50,
  width: 400,
  height: 80,
  zIndex: 2000,
  boxShadow: "4px 4px 4px grey",
  border: "1px solid #fafafa",
  fontSize: 12,
  background: "white",
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center'
};

const getElapsedTime = (time) => {
  const since = Number(time);
  const elapsed = Date.now() - since;
  const second = 1000;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (elapsed >= second && elapsed < minute) {
    const seconds = Math.floor(elapsed / second);
    return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  }
  if (elapsed >= minute && elapsed < hour) {
    const minutes = Math.floor(elapsed / minute);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }
  if (elapsed >= hour && elapsed < day) {
    const hours = Math.floor(elapsed / hour);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(elapsed / day);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const App = () => {
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState({});

  useEffect(() => {
    fetch("http://localhost:3000/history")
      .then((res) => res.json())
      .then((json) => {
        setOrders(json);
      });
  }, []);

  useEffect(() => {
    if (orders.length) {
      let i = 0;
      setActiveOrder(orders[i]);
      const interval = setInterval(() => {
        if (i === orders.length - 1) {
          i = 0;
        } else {
          i += 1;
        }
        setActiveOrder(orders[i]);
      }, [1000 * 10]);
      return () => {
        clearInterval(interval);
      };
    }
  }, [orders]);

  const { city, name, date_placed } = activeOrder;

  return Object.keys(activeOrder).length ? (
    <div style={styles}>
      <p>
        Someone in <strong>{city}</strong> bought <strong>{name}</strong>!
      </p>
      <small style={{ flexGrow: 1 }}>{getElapsedTime(new Date(date_placed))}</small>
    </div>
  ) : null;
};

export default App;
