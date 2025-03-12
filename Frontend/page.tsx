"use client";
import { useState } from "react";

export default function Home() {
  const [location1, setLocation1] = useState("");
  const [location2, setLocation2] = useState("");
  const [midpoint, setMidpoint] = useState(null);
  const [error, setError] = useState("");

  async function findMidpoint() {
    setError("");
    try {
      const response = await fetch("http://127.0.0.1:5001/api/midpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location1, location2 }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMidpoint(data.midpoint);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Meet Me Halfway</h1>
      <input
        className="border p-2 m-2"
        type="text"
        placeholder="Enter first location"
        value={location1}
        onChange={(e) => setLocation1(e.target.value)}
      />
      <input
        className="border p-2 m-2"
        type="text"
        placeholder="Enter second location"
        value={location2}
        onChange={(e) => setLocation2(e.target.value)}
      />
      <button className="bg-blue-500 text-white px-4 py-2" onClick={findMidpoint}>
        Find Midpoint
      </button>

      {error && <p className="text-red-500">{error}</p>}
      {midpoint && <p className="text-green-500">Midpoint: {midpoint}</p>}
    </div>
  );
}

