import { UploadedFile } from 'express-fileupload';
import { body, param } from 'express-validator';
import { supportedVideoExtensions } from '../utils';

export const videoUploadValidation = [
  body('filename')
    .optional()
    .isString()
    .withMessage('File name must be a string')
    .custom((_, { req }) => {
      const file: UploadedFile = req.files?.file;

      if (!file) {
        throw new Error('Video file must be provided');
      }

      if (req.files?.video) {
        if (!supportedVideoExtensions.some((ext) => file.name.endsWith(ext))) {
          throw new Error(
            `Video file not supported, only supports ${supportedVideoExtensions.join(
              ', ',
            )}`,
          );
        }
      }

      return true;
    }),
  param('hostingId').exists().withMessage('Hosting id must be provided'),
];
