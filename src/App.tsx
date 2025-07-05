import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Filter, Shuffle, Star, Calendar, Gamepad2, Trash2, Edit, X } from 'lucide-react';

// Types
interface Game {
  id: string;
  title: string;
  platforms: string[];
  genres: string[];
  coverUrl?: string;
  releaseDate?: string;
  description?: string;
  status: 'want-to-play' | 'playing' | 'completed' | 'dropped';
  rating?: number;
  notes?: string;
  dateAdded: string;
  dateCompleted?: string;
  rawgId?: number;
  metacriticScore?: number;
}

interface RAWGGame {
  id: number;
  name: string;
  background_image?: string;
  released?: string;
  description_raw?: string;
  platforms?: Array<{
    platform: {
      id: number;
      name: string;
    };
  }>;
  genres?: Array<{
    id: number;
    name: string;
  }>;
  metacritic?: number;
}

// Predefined options
const PLATFORMS = [
  'PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X/S', 'Xbox One', 
  'Nintendo Switch', 'Nintendo 3DS', 'Steam Deck', 'Mobile', 'VR'
];

const GENRES = [
  'Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Sports', 
  'Racing', 'Fighting', 'Puzzle', 'Platformer', 'Shooter', 'Horror',
  'Indie', 'Casual', 'MMO', 'Battle Royale'
];

const STATUS_OPTIONS = [
  { value: 'want-to-play', label: 'Want to Play', color: 'bg-blue-100 text-blue-800' },
  { value: 'playing', label: 'Currently Playing', color: 'bg-green-100 text-green-800' },
  { value: 'completed', label: 'Completed', color: 'bg-purple-100 text-purple-800' },
  { value: 'dropped', label: 'Dropped', color: 'bg-gray-100 text-gray-800' }
];

// Storage helpers
const STORAGE_KEY = 'gameBacklogData';

const loadGames = (): Game[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveGames = (games: Game[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
};

// RAWG API integration
const RAWG_API_BASE = 'https://api.rawg.io/api';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

const searchGames = async (query: string, apiKey: string): Promise<RAWGGame[]> => {
  if (!query.trim() || !apiKey.trim()) return [];
  
  try {
    const apiUrl = `${RAWG_API_BASE}/games?search=${encodeURIComponent(query)}&page_size=10&key=${apiKey}`;
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    
    const proxyData = await response.json();
    const data = JSON.parse(proxyData.contents);
    
    if (data.detail && data.detail.includes('Invalid API key')) {
      throw new Error('Invalid API key. Please check your RAWG.io API key.');
    }
    
    return data.results || [];
  } catch (error) {
    console.error('Failed to search games:', error);
    throw error;
  }
};

const getGameDetails = async (gameId: number, apiKey: string): Promise<RAWGGame | null> => {
  if (!apiKey.trim()) return null;
  
  try {
    const apiUrl = `${RAWG_API_BASE}/games/${gameId}?key=${apiKey}`;
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch game details');
    }
    
    const proxyData = await response.json();
    const data = JSON.parse(proxyData.contents);
    
    if (data.detail && data.detail.includes('Invalid API key')) {
      throw new Error('Invalid API key');
    }
    
    return data;
  } catch (error) {
    console.error('Failed to get game details:', error);
    throw error;
  }
};

const convertRAWGToGame = (rawgGame: RAWGGame): Omit<Game, 'id' | 'dateAdded' | 'status' | 'rating' | 'notes'> => {
  return {
    title: rawgGame.name,
    platforms: rawgGame.platforms?.map(p => p.platform.name) || [],
    genres: rawgGame.genres?.map(g => g.name) || [],
    coverUrl: rawgGame.background_image,
    releaseDate: rawgGame.released,
    description: rawgGame.description_raw,
    rawgId: rawgGame.id,
    metacriticScore: rawgGame.metacritic
  };
};

export default function GameBacklogApp() {
  const [games, setGames] = useState<Game[]>(loadGames);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rawg_api_key') || '');
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [sortOption, setSortOption] = useState('date-newest');

  // Save API key to localStorage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('rawg_api_key', apiKey);
    }
  }, [apiKey]);

  // Save to localStorage whenever games change
  useEffect(() => {
    saveGames(games);
  }, [games]);

  // Filter and sort games
  const filteredGames = useMemo(() => {
    let result = games.filter(game => {
      const matchesSearch = game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           game.genres.some(g => g.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesPlatforms = selectedPlatforms.length === 0 || 
                              selectedPlatforms.some(p => game.platforms.includes(p));
      const matchesGenres = selectedGenres.length === 0 || 
                           selectedGenres.some(g => game.genres.includes(g));
      const matchesStatus = selectedStatus.length === 0 || 
                           selectedStatus.includes(game.status);
      return matchesSearch && matchesPlatforms && matchesGenres && matchesStatus;
    });

    // Sorting
    switch (sortOption) {
      case 'title-az':
        result = result.slice().sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-za':
        result = result.slice().sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'date-oldest':
        result = result.slice().sort((a, b) => (a.dateAdded > b.dateAdded ? 1 : -1));
        break;
      case 'date-newest':
        result = result.slice().sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1));
        break;
      case 'status':
        result = result.slice().sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'rating-high':
        result = result.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'rating-low':
        result = result.slice().sort((a, b) => (a.rating || 0) - (b.rating || 0));
        break;
      default:
        break;
    }
    return result;
  }, [games, searchTerm, selectedPlatforms, selectedGenres, selectedStatus, sortOption]);

  // Add new game
  const addGame = (gameData: Omit<Game, 'id' | 'dateAdded'>) => {
    const newGame: Game = {
      ...gameData,
      id: Date.now().toString(),
      dateAdded: new Date().toISOString().split('T')[0]
    };
    setGames(prev => [...prev, newGame]);
    setShowAddForm(false);
  };

  // Update game
  const updateGame = (gameId: string, updates: Partial<Game>) => {
    setGames(prev => prev.map(game => 
      game.id === gameId ? { ...game, ...updates } : game
    ));
  };

  // Delete game
  const deleteGame = (gameId: string) => {
    setGames(prev => prev.filter(game => game.id !== gameId));
    setSelectedGame(null);
  };

  // Pick random game
  const pickRandomGame = () => {
    const eligibleGames = filteredGames.filter(game => 
      game.status === 'want-to-play' || game.status === 'playing'
    );
    if (eligibleGames.length > 0) {
      const randomGame = eligibleGames[Math.floor(Math.random() * eligibleGames.length)];
      setSelectedGame(randomGame);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedPlatforms([]);
    setSelectedGenres([]);
    setSelectedStatus([]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Tome of Games</h1>
              <span className="text-sm text-gray-500">({games.length} games)</span>
              {apiKey && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  API Connected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={pickRandomGame}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                disabled={filteredGames.filter(g => g.status === 'want-to-play' || g.status === 'playing').length === 0}
              >
                <Shuffle className="w-4 h-4" />
                Random Game
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Game
              </button>
              <button
                onClick={() => setShowApiKeyDialog(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Configure API Key"
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search games..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Sort Dropdown */}
            <div>
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700"
              >
                <option value="date-newest">Date Added (Newest)</option>
                <option value="date-oldest">Date Added (Oldest)</option>
                <option value="title-az">Title (A-Z)</option>
                <option value="title-za">Title (Z-A)</option>
                <option value="status">Status</option>
                <option value="rating-high">Rating (Highest)</option>
                <option value="rating-low">Rating (Lowest)</option>
              </select>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            {/* Clear Filters */}
            {(selectedPlatforms.length > 0 || selectedGenres.length > 0 || selectedStatus.length > 0) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <FilterSection
                title="Platforms"
                options={PLATFORMS}
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
              <FilterSection
                title="Genres"
                options={GENRES}
                selected={selectedGenres}
                onChange={setSelectedGenres}
              />
              <FilterSection
                title="Status"
                options={STATUS_OPTIONS.map(s => s.label)}
                selected={selectedStatus.map(s => STATUS_OPTIONS.find(opt => opt.value === s)?.label || s)}
                onChange={(labels) => setSelectedStatus(labels.map(label => 
                  STATUS_OPTIONS.find(opt => opt.label === label)?.value || label
                ))}
              />
            </div>
          )}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGames.map(game => {
            return (
              <div key={game.id}>
                <GameCard
                  game={game}
                  onClick={() => setSelectedGame(game)}
                  onStatusChange={(status) => updateGame(game.id, { status })}
                />
              </div>
            );
          })}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-12">
            <Gamepad2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No games found</h3>
            <p className="text-gray-500 mb-4">
              {!apiKey 
                ? "Configure your RAWG.io API key to search and add games!"
                : "Try adjusting your search or filters, or add some games to your backlog!"
              }
            </p>
            <div className="flex gap-2 justify-center">
              {!apiKey && (
                <button
                  onClick={() => setShowApiKeyDialog(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  ⚙️ Setup API Key
                </button>
              )}
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {apiKey ? "Search & Add Games" : "Add Manually"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Game Modal */}
      {showAddForm && (
        <AddGameModal
          onAdd={addGame}
          onClose={() => setShowAddForm(false)}
          apiKey={apiKey}
          onApiKeyNeeded={() => {
            setShowAddForm(false);
            setShowApiKeyDialog(true);
          }}
        />
      )}

      {/* API Key Dialog */}
      {showApiKeyDialog && (
        <ApiKeyDialog
          apiKey={apiKey}
          onSave={setApiKey}
          onClose={() => setShowApiKeyDialog(false)}
        />
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onUpdate={(updates) => updateGame(selectedGame.id, updates)}
          onDelete={() => deleteGame(selectedGame.id)}
        />
      )}
    </div>
  );
}

// Filter Section Component
function FilterSection({ title, options, selected, onChange }: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div>
      <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <button
            key={option}
            onClick={() => toggleOption(option)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selected.includes(option)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// Game Card Component
type GameCardProps = {
  game: Game;
  onClick: () => void;
  onStatusChange: (status: Game['status']) => void;
};

function GameCard(props: GameCardProps) {
  const { game, onClick, onStatusChange } = props;
  const statusConfig = STATUS_OPTIONS.find(s => s.value === game.status);

  return (
    <div className="bg-white shadow-sm border hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col h-full">
      {/* Cover Image */}
      {game.coverUrl && (
        <div onClick={onClick} className="relative h-32 overflow-hidden">
          <img 
            src={game.coverUrl} 
            alt={game.title}
            className="w-full h-full object-cover"
            style={{ borderRadius: 0 }}
          />
          <div className="absolute inset-0 bg-black bg-opacity-20" style={{ borderRadius: 0 }}></div>
        </div>
      )}
      
      <div onClick={onClick} className="p-4 flex-1">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{game.title}</h3>
        
        <div className="space-y-2 mb-3">
          {game.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {game.platforms.slice(0, 2).map(platform => (
                <span key={platform} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  {platform}
                </span>
              ))}
              {game.platforms.length > 2 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  +{game.platforms.length - 2}
                </span>
              )}
            </div>
          )}
          
          {game.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {game.genres.slice(0, 2).map(genre => (
                <span key={genre} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
                  {genre}
                </span>
              ))}
              {game.genres.length > 2 && (
                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
                  +{game.genres.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          {game.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="text-sm text-gray-600">{game.rating}/5</span>
            </div>
          )}
          
          {game.metacriticScore && (
            <div className="text-xs text-gray-500">
              MC: {game.metacriticScore}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <select
          value={game.status}
          onChange={(e) => {
            e.stopPropagation();
            onStatusChange(e.target.value as Game['status']);
          }}
          className={`w-full h-10 px-3 py-2 rounded-lg text-sm font-medium ${statusConfig?.color || 'bg-gray-100 text-gray-800'}`}
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Add Game Modal
function AddGameModal({ onAdd, onClose, apiKey, onApiKeyNeeded }: {
  onAdd: (game: Omit<Game, 'id' | 'dateAdded'>) => void;
  onClose: () => void;
  apiKey: string;
  onApiKeyNeeded: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RAWGGame[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedGameData, setSelectedGameData] = useState<RAWGGame | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    platforms: [] as string[],
    genres: [] as string[],
    status: 'want-to-play' as Game['status'],
    description: '',
    releaseDate: '',
    rating: undefined as number | undefined,
    notes: '',
    coverUrl: '',
    rawgId: undefined as number | undefined,
    metacriticScore: undefined as number | undefined
  });

  // Search for games
  const handleSearch = async () => {
    if (!apiKey.trim()) {
      setSearchError('API key required. Click the settings button to add your RAWG.io API key.');
      return;
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchError('Please enter at least 2 characters');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    
    try {
      const results = await searchGames(searchQuery, apiKey);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No games found. Try different search terms.');
      }
    } catch (error: any) {
      if (error.message.includes('API key')) {
        setSearchError('Invalid API key. Please check your RAWG.io API key in settings.');
      } else {
        setSearchError('Search failed. Please try again.');
      }
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Select a game from search results
  const selectGame = async (rawgGame: RAWGGame) => {
    setSelectedGameData(rawgGame);
    
    // Get detailed info
    try {
      const detailedGame = await getGameDetails(rawgGame.id, apiKey);
      if (detailedGame) {
        const gameData = convertRAWGToGame(detailedGame);
        setFormData(prev => ({
          ...prev,
          ...gameData
        }));
      }
    } catch (error) {
      console.error('Failed to get detailed game info:', error);
      // Still use basic info from search results
      const gameData = convertRAWGToGame(rawgGame);
      setFormData(prev => ({
        ...prev,
        ...gameData
      }));
    }
    
    setSearchResults([]);
    setSearchQuery('');
  };

  // Clear selection and start over
  const clearSelection = () => {
    setSelectedGameData(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setFormData({
      title: '',
      platforms: [] as string[],
      genres: [] as string[],
      status: 'want-to-play' as Game['status'],
      description: '',
      releaseDate: '',
      rating: undefined as number | undefined,
      notes: '',
      coverUrl: '',
      rawgId: undefined as number | undefined,
      metacriticScore: undefined as number | undefined
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onAdd(formData);
    }
  };

  const toggleArrayField = (field: 'platforms' | 'genres', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Add New Game</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {!selectedGameData ? (
            <div className="space-y-4">
              {/* API Search */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Search for a game
                  </label>
                  {!apiKey && (
                    <button
                      onClick={onApiKeyNeeded}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Need API key?
                    </button>
                  )}
                </div>
                
                {!apiKey && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      📋 <strong>API Key Required:</strong> To search the game database, you need a free RAWG.io API key.
                      <button
                        onClick={onApiKeyNeeded}
                        className="ml-1 text-amber-900 underline hover:text-amber-700"
                      >
                        Set up now
                      </button>
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={apiKey ? "Search games database..." : "Add API key to search..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={!apiKey}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || searchQuery.length < 2 || !apiKey}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Search
                      </>
                    )}
                  </button>
                </div>

                {/* Error Message */}
                {searchError && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    {searchError}
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    {searchResults.map(game => (
                      <button
                        key={game.id}
                        onClick={() => selectGame(game)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                      >
                        {game.background_image && (
                          <img
                            src={game.background_image}
                            alt={game.name}
                            className="w-12 h-12 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{game.name}</div>
                          <div className="text-sm text-gray-500">
                            {game.released && `Released: ${game.released}`}
                            {game.metacritic && ` • Metacritic: ${game.metacritic}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-center text-gray-500 py-4">
                <span className="text-sm">Or</span>
              </div>

              {/* Manual Entry Option */}
              <button
                onClick={() => setSelectedGameData({ id: 0, name: '' } as RAWGGame)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                + Add game manually
              </button>
            </div>
          ) : (
            /* Game Form */
            <div className="space-y-4">
              {/* Selected Game Header */}
              {selectedGameData.name && (
                <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                  <span className="text-green-800 font-medium">
                    Selected: {selectedGameData.name}
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-green-600 hover:text-green-800"
                  >
                    Change
                  </button>
                </div>
              )}

              <div onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Game Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {formData.coverUrl && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                      <img 
                        src={formData.coverUrl} 
                        alt={formData.title}
                        className="w-full h-48 object-cover"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map(platform => (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => toggleArrayField('platforms', platform)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            formData.platforms.includes(platform)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {platform}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genres</label>
                    <div className="flex flex-wrap gap-2">
                      {GENRES.map(genre => (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleArrayField('genres', genre)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            formData.genres.includes(genre)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Game['status'] }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {STATUS_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                      <input
                        type="date"
                        value={formData.releaseDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, releaseDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personal Rating (1-5)
                    </label>
                    <select
                      value={formData.rating || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        rating: e.target.value ? Number(e.target.value) : undefined 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No rating</option>
                      {[1, 2, 3, 4, 5].map(rating => (
                        <option key={rating} value={rating}>{rating} Star{rating !== 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>

                  {formData.metacriticScore && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Metacritic Score</label>
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-600">
                        {formData.metacriticScore}/100
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add Game
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// API Key Dialog
function ApiKeyDialog({ apiKey, onSave, onClose }: {
  apiKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
}) {
  const [inputKey, setInputKey] = useState(apiKey);

  const handleSave = () => {
    onSave(inputKey.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Configure API Key</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">🎮 Get Your Free RAWG.io API Key</h3>
            <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
              <li>Visit <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">rawg.io/apidocs</a></li>
              <li>Sign up for a free account</li>
              <li>Get your API key (20,000 requests/month free)</li>
              <li>Paste it below</li>
            </ol>
            <p className="text-xs text-blue-700 mt-2">
              ℹ️ <strong>Note:</strong> Due to browser security restrictions, we use a CORS proxy to access the RAWG API. This is normal and safe.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Enter your RAWG.io API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your API key is stored locally in your browser only.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save API Key
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Game Detail Modal
function GameDetailModal({ game, onClose, onUpdate, onDelete }: {
  game: Game;
  onClose: () => void;
  onUpdate: (updates: Partial<Game>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(game);
  const [localStatus, setLocalStatus] = useState(game.status);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    setLocalStatus(game.status);
  }, [game.status]);

  const statusConfig = STATUS_OPTIONS.find(s => s.value === game.status);

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleStatusChange = (status: Game['status']) => {
    const updates: Partial<Game> = { status };
    if (status === 'completed' && game.status !== 'completed') {
      updates.dateCompleted = new Date().toISOString().split('T')[0];
    } else if (status !== 'completed') {
      updates.dateCompleted = undefined;
    }
    onUpdate(updates);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{game.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {!isEditing ? (
            <>
              {/* Cover Image */}
              {game.coverUrl && (
                <div className="mb-4">
                  <img 
                    src={game.coverUrl} 
                    alt={game.title}
                    className="w-full h-48 object-cover cursor-zoom-in"
                    style={{ borderRadius: 0 }}
                    onClick={() => setShowImageModal(true)}
                    title="Click to enlarge"
                  />
                </div>
              )}

              {/* Enlarged Image Modal */}
              {showImageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={() => setShowImageModal(false)}>
                  <div className="relative max-w-3xl w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowImageModal(false)} className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-80 z-10">
                      <X className="w-6 h-6" />
                    </button>
                    <img
                      src={game.coverUrl}
                      alt={game.title}
                      className="w-full max-h-[80vh] object-contain bg-black"
                      style={{ borderRadius: 0 }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                {game.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span>{game.rating}/5</span>
                  </div>
                )}
                {game.metacriticScore && (
                  <div className="text-sm text-gray-600">
                    Metacritic: {game.metacriticScore}/100
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Status</h3>
                <select
                  value={localStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value as Game['status'];
                    setLocalStatus(newStatus);
                    handleStatusChange(newStatus);
                  }}
                  className={`px-3 py-2 rounded-lg font-medium ${statusConfig?.color}`}
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {game.platforms.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Platforms</h3>
                  <div className="flex flex-wrap gap-2">
                    {game.platforms.map(platform => (
                      <span key={platform} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {game.genres.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {game.genres.map(genre => (
                      <span key={genre} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {game.description && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-600">{game.description}</p>
                </div>
              )}

              {game.notes && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Notes</h3>
                  <p className="text-gray-600">{game.notes}</p>
                </div>
              )}

              <div className="text-sm text-gray-500 space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Added: {game.dateAdded}</span>
                </div>
                {game.releaseDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Released: {game.releaseDate}</span>
                  </div>
                )}
                {game.dateCompleted && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Completed: {game.dateCompleted}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editData.notes || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
                <select
                  value={editData.rating || ''}
                  onChange={(e) => setEditData(prev => ({ 
                    ...prev, 
                    rating: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No rating</option>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <option key={rating} value={rating}>{rating} Star{rating !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData(game);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}