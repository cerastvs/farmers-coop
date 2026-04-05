"use client";

import { useEffect, useState } from "react";

import { useUser } from "../hooks/useUser";

export default function Dashboard() {
  //temporary muna
  const [id, setId] = useState<string>("1");
  const { user, setUser } = useUser();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch(`/api/user/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>No user found.</p>;
  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
    </div>
  );
}
