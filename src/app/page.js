"use client"

import { useEffect, useState } from "react";
import { redirect } from 'next/navigation';

export default function Home() {
  const [password, setPassword] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (password != null) {
      document.cookie = `pswd=${password}; path=/`;
      redirect("/upload");
    }
  }, [password]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full mx-4 space-y-8 p-10 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Log Parser</h1>
          <p className="text-sm text-gray-600">
            Enter your password to access the log file viewer
          </p>
        </div>

        <form 
          className="mt-10 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const value = e.target[0].value;
            if (!value.trim()) {
              setError('Password is required');
              return;
            }
            setPassword(value);
          }}
        >
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className={`appearance-none rounded-lg relative block w-full px-4 py-3 border ${
                  error ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Enter password"
                onChange={() => error && setError('')}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 mt-2">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              Enter
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Protected access to log file viewer</p>
        </div>
      </div>
    </div>
  );
}
