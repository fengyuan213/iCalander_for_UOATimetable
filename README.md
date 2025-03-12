# Timetable to iCal - University of Adelaide

A Chrome extension that converts University of Adelaide timetables into iCal format for easy import into calendar applications.

![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)
![License](https://img.shields.io/github/license/fengyuan213/iCalander_for_UOATimetable)

## Features

- 🔄 One-click timetable extraction from MyAdelaide
- 📅 Generates standard iCal (.ics) files
- 🎓 Supports all UoA course types (Lectures, Tutorials, Workshops, etc.)
- 🌐 Works with Adelaide timezone
- 🔒 Privacy-focused: All processing happens locally

## Installation

~~1. Visit the [Chrome Web Store](YOUR_CHROME_STORE_LINK)~~  
~~2. Click "Add to Chrome"~~  
~~3. Accept the required permissions~~

**Note:** The extension is currently under development and not yet available in the Chrome Web Store. Please follow the [Development](#development) section to install it locally.

## How to Use

1. Log in to MyAdelaide
2. Navigate to: STUDIES → Timetable
3. Click CLASSLIST at the top right corner
4. Click the extension icon in your browser
5. Click "Extract Timetable"
6. Click "Generate iCal" to download your calendar file
7. Import the .ics file into your preferred calendar application

## Privacy

This extension:
- Processes all data locally in your browser
- Does not collect or transmit any personal information
- Does not use any analytics or tracking
- Only requires minimal permissions

[Read our full privacy policy](https://fengyuan213.github.io/iCalander_for_UOATimetable/privacy-policy)

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/fengyuan213/iCalander_for_UOATimetable.git

# Install dependencies
npm install

# Build the extension
npm run build

```

### Loading in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder from the project

## Technical Details

Built with:
- Svelte 5
- TypeScript
- Vite
- Chrome Extension Manifest V3

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/fengyuan213/iCalander_for_UOATimetable/issues) page
2. Create a new issue if your problem isn't already listed

## Acknowledgments

- University of Adelaide for the timetable system
- All contributors who help improve this extension 