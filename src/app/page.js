"use client"

import { useEffect, useState } from "react";
import { redirect } from 'next/navigation';
import styles from "./page.module.css";

export default function Home() {

  const [password, setPassword] = useState(null)

  useEffect(() => {
    document.cookie = `pswd=${password}; path=/`
    if(password != null){
      redirect("/upload")
    }
  }, [password])
  
  return (
    <div className={styles.page}>
      <div>
        <h1>Log Parser</h1>
        <form onSubmit={(e) => {
          e.preventDefault();
          setPassword(e.target[0].value);
          // console.log(e);
        }}>
        <input 
            prop="passwordForm"
            type="password"
            value={password}
            placeholder="Enter password"
          />
          <button type='submit' >Enter</button>
        </form>
      </div>
    </div>
  );
}
