import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/lib/api', () => ({ API_BASE: 'https://api.tdfrecords.net' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: { selected: '#eee' } }) }));

import { DirectoryPreviewImage } from '../src/components/DirectoryPreviewImage';
import { resolveDirectoryPreviewImage } from '../src/features/directory/previewImage';

describe('resolveDirectoryPreviewImage', () => {
  it('keeps canonical HTTPS media and resolves API-served paths', () => {
    expect(resolveDirectoryPreviewImage('https://www.tdfrecords.net/tdf-app-icon-1024.png'))
      .toBe('https://www.tdfrecords.net/tdf-app-icon-1024.png');
    expect(resolveDirectoryPreviewImage('/assets/serve/profiles/a.webp'))
      .toBe('https://api.tdfrecords.net/assets/serve/profiles/a.webp');
  });

  it('rejects missing, unsafe or credentialed URLs', () => {
    expect(resolveDirectoryPreviewImage(null)).toBeUndefined();
    expect(resolveDirectoryPreviewImage('javascript:alert(1)')).toBeUndefined();
    expect(resolveDirectoryPreviewImage('//evil.test/a.png')).toBeUndefined();
    expect(resolveDirectoryPreviewImage('https://user:pw@evil.test/a.png')).toBeUndefined();
  });
});

describe('DirectoryPreviewImage', () => {
  it.each([
    ['TDF Records', 'https://www.tdfrecords.net/tdf-app-icon-1024.png'],
    ['Domo del Pululahua', 'https://www.tdfrecords.net/assets/tdf-ui/domo-pululahua-hero-cozy.jpg'],
  ])('renders the real image for %s', (label, imageUrl) => {
    const screen = render(<DirectoryPreviewImage kind="profile" imageUrl={imageUrl} label={label} />);
    expect(screen.getByTestId('directory-preview-image').props.source).toEqual({ uri: imageUrl });
    expect(screen.getByLabelText(`Foto de ${label}`)).toBeTruthy();
  });

  it('shows the placeholder only without valid media and after a broken image', () => {
    const empty = render(<DirectoryPreviewImage kind="venue" imageUrl={null} label="Venue" />);
    expect(empty.getByTestId('directory-preview-placeholder')).toBeTruthy();

    const broken = render(<DirectoryPreviewImage kind="profile" imageUrl="https://cdn.example.test/missing.jpg" label="Artista" />);
    fireEvent(broken.getByTestId('directory-preview-image'), 'error');
    expect(broken.getByTestId('directory-preview-placeholder')).toBeTruthy();
    expect(broken.getByLabelText('Imagen de referencia de Artista')).toBeTruthy();
  });
});
