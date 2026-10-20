"use client";

import { useEffect } from "react";

function Test() {
  useEffect(() => {
    fetch("http://127.0.0.1:8000/health/")
      .then((res) => {
        if (!res.ok) throw "Failed";
        return res.json();
      })
      .then((data) => {
        console.log(data);
      });
  }, []);
  return null;
}

export default Test;
