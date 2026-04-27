// src/components/Layout.jsx
import React from 'react';
import Footer from './Footer';
import Navbar from './Navbar';

const Layout = ({ children, userRole, setRole, setUserProfile }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Navigation */}
      <header className="w-full">
        <Navbar
          userRole={userRole}
          setRole={setRole}
          setUserProfile={setUserProfile}
        />
      </header>

      {/* Main Content Area */}
      <main
        className="flex-1"
        style={{
          minHeight: 'calc(100vh - 200px)', // enough room for content + footer
          paddingBottom: '80px' // prevents footer overlap on short pages
        }}
      >
        {children}
      </main>

      {/* Global Footer */}
      <footer className="w-full">
        <Footer />
      </footer>
    </div>
  );
};

export default Layout;