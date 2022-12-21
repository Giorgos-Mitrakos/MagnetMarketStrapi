/*
 *
 * HomePage
 *
 */

import React from 'react';
// import PropTypes from 'prop-types';
import pluginId from '../../pluginId';
import { Box } from '@strapi/design-system/Box';
import { BaseHeaderLayout } from '@strapi/design-system/Layout';
import PlatformsScreen from '../../components/platforms';

const HomePage = () => {
  return (
    <>
      <Box background="neutral100">
        <BaseHeaderLayout
          title="Scrapping Πλατφορμών"
          subtitle="Κάνε Scapping τις πλατφόρμες πώλησης που χρησιμοποιείς"
          as="h2"
        />
        <PlatformsScreen/>
      </Box>
    </>
  );
};

export default HomePage;
