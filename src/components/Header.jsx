import React from 'react';

const Header = () => (
  <header className="bg-orange-500 text-white p-4 shadow-md">
    <div className="max-w-7xl mx-auto flex justify-between items-center">
      <h1 className="text-2xl font-bold">Frame My Event</h1>
      <nav>
        <ul className="flex gap-4">
          <li><a href="#features" className="hover:underline">Features</a></li>
          <li><a href="#about" className="hover:underline">About</a></li>
          <li><a href="#contact" className="hover:underline">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>
);

export default Header;