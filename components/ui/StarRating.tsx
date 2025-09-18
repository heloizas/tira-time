import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
  onChange?: (rating: number) => void
}

export function StarRating({
  rating,
  maxRating = 3,
  size = 'md',
  readonly = false,
  onChange
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const handleClick = (newRating: number) => {
    if (!readonly && onChange) {
      onChange(newRating)
    }
  }

  return (
    <div className="flex items-center space-x-1">
      {Array.from({ length: maxRating }, (_, index) => {
        const starNumber = index + 1
        const isFilled = starNumber <= rating

        return (
          <Star
            key={index}
            className={`
              ${sizeClasses[size]}
              ${isFilled ? 'text-orange-500 fill-current' : 'text-gray-300'}
              ${!readonly ? 'cursor-pointer hover:text-orange-400' : ''}
              transition-colors duration-200
            `}
            onClick={() => handleClick(starNumber)}
          />
        )
      })}
    </div>
  )
}