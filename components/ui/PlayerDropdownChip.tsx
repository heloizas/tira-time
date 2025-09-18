import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Users, Check } from 'lucide-react'
import { Player } from '@/types/database'

interface PlayerDropdownChipProps {
  players: Player[]
  selectedPlayers: string[]
  onPlayersChange: (playerIds: string[]) => void
  error?: string
}

export function PlayerDropdownChip({
  players,
  selectedPlayers,
  onPlayersChange,
  error
}: PlayerDropdownChipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePlayerToggle = (playerId: string) => {
    const newSelected = selectedPlayers.includes(playerId)
      ? selectedPlayers.filter(id => id !== playerId)
      : [...selectedPlayers, playerId]

    onPlayersChange(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPlayers.length === players.length) {
      onPlayersChange([])
    } else {
      onPlayersChange(players.map(p => p.id))
    }
  }

  const removePlayer = (playerId: string) => {
    onPlayersChange(selectedPlayers.filter(id => id !== playerId))
  }

  const selectedPlayerNames = selectedPlayers.map(id =>
    players.find(p => p.id === id)?.name
  ).filter(Boolean)

  const allSelected = selectedPlayers.length === players.length && players.length > 0

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Selecionar Jogadores ({selectedPlayers.length} selecionados)
      </label>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full min-h-[42px] px-3 py-2 border rounded-lg shadow-sm text-left
            focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${isOpen ? 'ring-2 ring-purple-500 border-transparent' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {selectedPlayers.length === 0 ? (
                <span className="text-gray-400">Selecione jogadores...</span>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {selectedPlayerNames.map((name, index) => (
                    <span
                      key={selectedPlayers[index]}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removePlayer(selectedPlayers[index])
                        }}
                        className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2 border-b border-gray-200">
              <button
                type="button"
                onClick={handleSelectAll}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">
                    {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </span>
                </div>
                {allSelected && <Check className="w-4 h-4 text-purple-600" />}
              </button>
            </div>

            <div className="p-1">
              {players.map((player) => {
                const isSelected = selectedPlayers.includes(player.id)
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handlePlayerToggle(player.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-colors
                      ${isSelected
                        ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        : 'hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{player.name}</span>
                      <div className="flex">
                        {Array.from({ length: player.level }, (_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 bg-orange-400 rounded-full ml-0.5"
                          />
                        ))}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-purple-600" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}