import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut } from 'lucide-react';
import logo from '../assets/id-logo.png';

// Receive activeTab and setActiveTab as props
const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="bg-[#2A2828] border-b border-[#3F3F3F] px-4 py-2 flex items-center justify-between">
      {/* Left Section: Logo */}
      <div className="flex items-center">
        <img src={logo} alt="InsightDuck Logo" className="h-8 w-auto" />
      </div>

      {/* Middle Section: Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('EDA')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'EDA'
              ? 'bg-[#F5D742] text-[#1E1C1C]'
              : 'text-[#A1A1A1] hover:bg-[#3F3F3F] hover:text-[#E8E8E8]'
          }`}
        >
          EDA
        </button>
        <button
          onClick={() => setActiveTab('Data Cleaning')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'Data Cleaning'
              ? 'bg-[#F5D742] text-[#1E1C1C]'
              : 'text-[#A1A1A1] hover:bg-[#3F3F3F] hover:text-[#E8E8E8]'
          }`}
        >
          Data Cleaning
        </button>
      </div>

      {/* Right Section: User Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-9 h-9 flex items-center justify-center bg-[#3F3F3F] rounded-full hover:bg-[#F5D742] hover:text-[#1E1C1C] transition-colors"
        >
          <User className="h-5 w-5" />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div 
            className="absolute right-0 mt-2 w-56 bg-[#2A2828] border border-[#3F3F3F] rounded-lg shadow-lg py-2 z-10"
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <div className="px-4 py-2 border-b border-[#3F3F3F]">
              <p className="text-sm text-[#A1A1A1]">Signed in as</p>
              <p className="text-sm font-medium text-[#E8E8E8] truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-[#E8E8E8] hover:bg-[#3F3F3F] flex items-center"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
